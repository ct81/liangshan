"""
Train a fire/smoke detector with Ultralytics YOLO.

Usage:
    python train.py                              # defaults
    python train.py --model yolo26m.pt --epochs 150 --imgsz 640 --batch 16
    python train.py --resume                     # continue an interrupted run

When finished, the best weights are copied to ./best.pt (old one is backed up)
so app.py and test_model.py pick it up automatically.
"""
import argparse
import os
import shutil

from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_YAML = os.path.join(BASE_DIR, "dataset", "data.yaml")
BEST_DST = os.path.join(BASE_DIR, "best.pt")
IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")


def count_files(folder, exts):
    if not os.path.isdir(folder):
        return 0
    return sum(1 for f in os.listdir(folder) if f.lower().endswith(exts))


def prepare_data_yaml(data_path):
    """Write a copy of data.yaml with an absolute dataset path (avoids the
    'images not found' error caused by relative paths) and check the folders."""
    import yaml
    with open(data_path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    root = os.path.dirname(os.path.abspath(data_path))
    cfg["path"] = root.replace("\\", "/")

    for key in ("train", "val"):
        img_dir = os.path.normpath(os.path.join(root, cfg[key]))
        lbl_dir = os.path.join(os.path.dirname(os.path.dirname(img_dir)),
                               os.path.basename(os.path.dirname(img_dir)), "labels")
        n_img = count_files(img_dir, IMG_EXTS)
        n_lbl = count_files(lbl_dir, (".txt",))
        print(f"[{key}] images: {n_img} in {img_dir} | labels: {n_lbl}")
        if n_img == 0:
            raise SystemExit(
                f"\n[ERROR] No images found in {img_dir}\n"
                "Your dataset folder is empty. Download a fire/smoke dataset in YOLO format\n"
                "(e.g. D-Fire) and copy its images and labels into:\n"
                "  dataset/train/images  dataset/train/labels\n"
                "  dataset/valid/images  dataset/valid/labels")
        if n_lbl == 0:
            raise SystemExit(f"\n[ERROR] No label (.txt) files found in {lbl_dir}")

    out = os.path.join(root, "data_resolved.yaml")
    with open(out, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, sort_keys=False)
    return out


def warn_if_cpu(device):
    try:
        import torch
        if device in (None, "") and not torch.cuda.is_available():
            print("\n[WARNING] No GPU detected - training will run on the CPU and can take "
                  "many hours.\n  Faster options: --model yolo26n.pt --epochs 30 --batch 8, "
                  "or train on Google Colab (free GPU).\n")
    except Exception:
        pass


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=DATA_YAML)
    p.add_argument("--model", default="yolo26s.pt",
                   help="n=fastest, s, m, l, x=most accurate (e.g. yolo26n.pt ... yolo26x.pt)")
    p.add_argument("--epochs", type=int, default=100)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=16, help="Lower it (8, 4) if you run out of GPU memory")
    p.add_argument("--patience", type=int, default=30, help="Stop early if no improvement")
    p.add_argument("--device", default=None, help="0 for first GPU, 'cpu' for CPU (very slow)")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--resume", action="store_true")
    args = p.parse_args()

    if not os.path.isfile(args.data):
        raise SystemExit(f"[ERROR] data.yaml not found: {args.data}")

    data_file = prepare_data_yaml(args.data)
    warn_if_cpu(args.device)

    if args.resume:
        last = os.path.join(BASE_DIR, "runs", "detect", "train", "weights", "last.pt")
        model = YOLO(last)
        model.train(resume=True)
    else:
        model = YOLO(args.model)  # downloads pretrained weights the first time
        model.train(
            data=data_file,
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
            patience=args.patience,
            device=args.device,
            workers=args.workers,
            project=os.path.join(BASE_DIR, "runs", "detect"),
            name="train",
            exist_ok=False,
        )

    save_dir = str(model.trainer.save_dir)
    best = os.path.join(save_dir, "weights", "best.pt")
    if not os.path.isfile(best):
        raise SystemExit(f"[ERROR] best.pt not found in {save_dir}")

    print("\nValidating best.pt on the validation set...")
    m = YOLO(best).val(data=data_file, imgsz=args.imgsz)
    print(f"mAP50: {m.box.map50:.3f} | mAP50-95: {m.box.map:.3f} | "
          f"precision: {m.box.mp:.3f} | recall: {m.box.mr:.3f}")

    if os.path.isfile(BEST_DST):
        shutil.copy2(BEST_DST, BEST_DST + ".bak")
    shutil.copy2(best, BEST_DST)
    print(f"[OK] Copied {best} -> {BEST_DST}")
    print(f"Charts (results.png, confusion_matrix.png): {save_dir}")


if __name__ == "__main__":
    main()
