"""
Fire Detection - test script (YOLO)

Processes ALL images in images/ and ALL videos in videos/.
Results are saved in output/images/ and output/videos/.

Usage:
    python test_model.py                  # all images + all videos
    python test_model.py --mode image
    python test_model.py --mode video
    python test_model.py --mode webcam
    python test_model.py --conf 0.4
"""
import argparse
import os
import sys
import cv2
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")
IMAGE_DIR = os.path.join(BASE_DIR, "images")
VIDEO_DIR = os.path.join(BASE_DIR, "videos")
OUT_IMAGE_DIR = os.path.join(BASE_DIR, "output", "images")
OUT_VIDEO_DIR = os.path.join(BASE_DIR, "output", "videos")

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
VIDEO_EXTS = (".mp4", ".avi", ".mov", ".mkv", ".wmv")


def list_files(folder, exts):
    if not os.path.isdir(folder):
        return []
    return sorted(
        os.path.join(folder, f)
        for f in os.listdir(folder)
        if f.lower().endswith(exts)
    )


def check_model():
    if not os.path.isfile(MODEL_PATH):
        print(f"[ERROR] Model not found: {MODEL_PATH}")
        return False
    if os.path.getsize(MODEL_PATH) < 100_000:
        print(f"[ERROR] best.pt is only {os.path.getsize(MODEL_PATH)} bytes - it looks "
              "like a placeholder. Replace it with your real trained weights.")
        return False
    return True


def process_images(model, conf):
    files = list_files(IMAGE_DIR, IMAGE_EXTS)
    if not files:
        print(f"[WARN] No images found in {IMAGE_DIR}")
        return
    os.makedirs(OUT_IMAGE_DIR, exist_ok=True)
    print(f"Found {len(files)} image(s)")
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0]
        results = model.predict(path, conf=conf, verbose=False)
        out_path = os.path.join(OUT_IMAGE_DIR, f"{name}_result.jpg")
        cv2.imwrite(out_path, results[0].plot())
        print(f"[OK] {os.path.basename(path)} | Detections: {len(results[0].boxes)} -> {out_path}")


def process_videos(model, conf):
    files = list_files(VIDEO_DIR, VIDEO_EXTS)
    if not files:
        print(f"[WARN] No videos found in {VIDEO_DIR}")
        return
    os.makedirs(OUT_VIDEO_DIR, exist_ok=True)
    print(f"Found {len(files)} video(s)")
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0]
        out_path = os.path.join(OUT_VIDEO_DIR, f"{name}_result.mp4")

        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            print(f"[ERROR] Cannot open video: {path}")
            continue
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

        frames, fire_frames = 0, 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            res = model.predict(frame, conf=conf, verbose=False)
            if len(res[0].boxes) > 0:
                fire_frames += 1
            writer.write(res[0].plot())
            frames += 1
        cap.release()
        writer.release()
        print(f"[OK] {os.path.basename(path)} | Frames: {frames} | "
              f"With detection: {fire_frames} -> {out_path}")


def process_webcam(model, conf):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Cannot open webcam")
        return
    print("Press 'q' to quit.")
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        res = model.predict(frame, conf=conf, verbose=False)
        cv2.imshow("Fire Detection", res[0].plot())
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["all", "image", "video", "webcam"], default="all")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    args = parser.parse_args()

    if not check_model():
        sys.exit(1)
    model = YOLO(MODEL_PATH)

    if args.mode in ("all", "image"):
        process_images(model, args.conf)
    if args.mode in ("all", "video"):
        process_videos(model, args.conf)
    if args.mode == "webcam":
        process_webcam(model, args.conf)


if __name__ == "__main__":
    main()
