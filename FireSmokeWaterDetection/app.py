"""
Fire, Smoke & Water Leak Detection - web server

Serves the live-camera page (web/index.html) and a /detect API that runs
the YOLO model (best.pt) on frames sent from the browser.

Run (starts the server AND opens the page in your browser):
    python app.py
    python app.py --port 8000 --conf 0.25
    python app.py --model yolo11n.pt     (pipeline test only - detects objects, not fire)
Then open:  http://localhost:5000
"""
import argparse
import os
import sys
import threading
import time
import webbrowser

import cv2
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")
WEB_DIR = os.path.join(BASE_DIR, "web")

app = Flask(__name__, static_folder=None)
model = None
DEFAULT_CONF = 0.25
DEFAULT_IMGSZ = 640


def load_model(path=MODEL_PATH):
    if os.path.isfile(path):
        if os.path.getsize(path) < 100_000:
            sys.exit(f"[ERROR] {path} looks like a placeholder (under 100 KB). "
                     "Replace it with your real trained weights.")
    elif path == MODEL_PATH:
        sys.exit(f"[ERROR] Model not found: {MODEL_PATH}")
    # otherwise 'path' may be an official model name (e.g. yolo11n.pt) that Ultralytics downloads
    m = YOLO(path)
    print(f"[OK] Model loaded. Classes: {m.names}")
    return m


@app.after_request
def add_cors(resp):
    """Allow the page to be hosted elsewhere (e.g. Visual Studio / IIS Express)."""
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Private-Network"] = "true"
    return resp


@app.get("/")
def index():
    return send_from_directory(WEB_DIR, "index.html")


@app.get("/health")
def health():
    return jsonify(ok=True, version=5, cors=True, classes=model.names if model else None)


@app.post("/detect")
def detect():
    """Body: raw JPEG bytes. Query: ?conf=0.25. Returns boxes in the pixel
    coordinates of the received frame."""
    data = request.get_data()
    if not data:
        return jsonify(error="empty body"), 400

    frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify(error="could not decode image"), 400

    try:
        conf = float(request.args.get("conf", DEFAULT_CONF))
    except ValueError:
        conf = DEFAULT_CONF

    try:
        imgsz = int(request.args.get("imgsz", DEFAULT_IMGSZ))
    except ValueError:
        imgsz = DEFAULT_IMGSZ
    imgsz = max(320, min(1280, (imgsz // 32) * 32))  # YOLO needs multiples of 32

    try:
        iou = float(request.args.get("iou", 0.45))
    except ValueError:
        iou = 0.45

    t0 = time.time()
    result = model.predict(frame, conf=conf, iou=iou, imgsz=imgsz, verbose=False)[0]
    ms = round((time.time() - t0) * 1000)

    detections = []
    for box, score, cls in zip(
        result.boxes.xyxy.cpu().numpy(),
        result.boxes.conf.cpu().numpy(),
        result.boxes.cls.cpu().numpy(),
    ):
        detections.append({
            "label": str(model.names[int(cls)]),
            "conf": round(float(score), 3),
            "box": [round(float(v), 1) for v in box],  # x1, y1, x2, y2
        })

    h, w = frame.shape[:2]
    return jsonify(width=w, height=h, ms=ms, detections=detections)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1",
                        help="Use 0.0.0.0 to allow other devices on your network")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--imgsz", type=int, default=640,
                        help="Inference size. Use the size you trained with (e.g. 640 or 960)")
    parser.add_argument("--no-browser", action="store_true",
                        help="Do not open the page automatically")
    parser.add_argument("--model", default=MODEL_PATH,
                        help="Weights file (default: best.pt). For a pipeline test only: yolo11n.pt")
    args = parser.parse_args()

    DEFAULT_CONF = args.conf
    DEFAULT_IMGSZ = args.imgsz
    model = load_model(args.model)
    print("[OK] CORS enabled (pages hosted on other ports can call this server)")
    url = f"http://localhost:{args.port}"
    print(f"Open {url}")
    if not args.no_browser:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    app.run(host=args.host, port=args.port, threaded=True)
