"""
Arrange a downloaded YOLO-format fire/smoke dataset into ./dataset

Works with:
  * Official D-Fire download      (train/images, train/labels, test/images, test/labels)
  * Roboflow "YOLO" export        (train, valid, test + data.yaml)
  * Any folder with train/ (and optionally valid/ or val/, test/) split folders

Usage:
    python prepare_dataset.py --src C:\\Downloads\\D-Fire
    python prepare_dataset.py --src C:\\Downloads\\export --val-split 0.15
    python prepare_dataset.py --src C:\\Downloads\\D-Fire --limit 3000     # small set for a quick CPU test
    python prepare_dataset.py --src ... --clean     # wipe existing dataset/ images first

Add a water-leak dataset on top of D-Fire (one class in the download -> class id 2):
    python prepare_dataset.py --src C:\\Downloads\\D-Fire --clean
    python prepare_dataset.py --src C:\\Downloads\\water-leak --append --prefix leak_ --remap 0:2 --names smoke,fire,water_leak
"""
import argparse
import os
import random
import shutil
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
LABEL_DIRS = ("labels", "det_labels")


def find_split(root, names):
    """Return (images_dir, labels_dir) for the first split folder that exists."""
    for n in names:
        d = os.path.join(root, n)
        img = os.path.join(d, "images")
        lbl = next((os.path.join(d, l) for l in LABEL_DIRS if os.path.isdir(os.path.join(d, l))), None)
        if os.path.isdir(img) and lbl:
            return img, lbl
    return None


def locate_root(src, depth=3):
    """The extracted zip may add a wrapper folder, so search a few levels down."""
    level = [src]
    for _ in range(depth + 1):
        for d in level:
            if find_split(d, ("train",)):
                return d
        level = [os.path.join(d, x) for d in level if os.path.isdir(d)
                 for x in sorted(os.listdir(d)) if os.path.isdir(os.path.join(d, x))]
    return None


def list_pairs(img_dir, lbl_dir):
    pairs = []
    for f in sorted(os.listdir(img_dir)):
        if f.lower().endswith(IMG_EXTS):
            stem = os.path.splitext(f)[0]
            lbl = os.path.join(lbl_dir, stem + ".txt")
            pairs.append((os.path.join(img_dir, f), lbl if os.path.isfile(lbl) else None))
    return pairs


def parse_remap(text):
    """'0:2' or '0:2,1:2' -> {0: 2, 1: 2}  (source class id -> dataset class id)"""
    if not text:
        return None
    out = {}
    for part in text.split(","):
        a, b = part.split(":")
        out[int(a)] = int(b)
    return out


def convert_label(src, dst, remap):
    """Copy a label file, renumbering classes. Classes not in remap are dropped."""
    lines = []
    if src:
        with open(src) as f:
            for line in f:
                p = line.split()
                if not p:
                    continue
                if remap is not None:
                    cid = int(float(p[0]))
                    if cid not in remap:
                        continue
                    p[0] = str(remap[cid])
                lines.append(" ".join(p))
    with open(dst, "w") as f:  # no label lines = background image
        f.write("\n".join(lines) + ("\n" if lines else ""))


def put(pairs, dest_root, split, move, prefix="", remap=None):
    img_out = os.path.join(dest_root, split, "images")
    lbl_out = os.path.join(dest_root, split, "labels")
    os.makedirs(img_out, exist_ok=True)
    os.makedirs(lbl_out, exist_ok=True)
    op = shutil.move if move else shutil.copy2
    for img, _ in pairs:  # check every name first so a refused run leaves nothing behind
        target = os.path.join(img_out, prefix + os.path.basename(img))
        if os.path.exists(target):
            sys.exit(f"[ERROR] {target} already exists. When adding a second dataset, "
                     "use --prefix (for example --prefix leak_) to avoid name clashes.")
    for img, lbl in pairs:
        name = prefix + os.path.basename(img)
        target = os.path.join(img_out, name)
        op(img, target)
        convert_label(lbl, os.path.join(lbl_out, os.path.splitext(name)[0] + ".txt"), remap)
        if move and lbl and os.path.exists(lbl):
            os.remove(lbl)
    return len(pairs)


def class_counts(lbl_dir):
    counts = {}
    for f in os.listdir(lbl_dir):
        if f.endswith(".txt"):
            with open(os.path.join(lbl_dir, f)) as fh:
                for line in fh:
                    parts = line.split()
                    if parts:
                        counts[parts[0]] = counts.get(parts[0], 0) + 1
    return counts


def read_names(src_root):
    """Use the class names from the dataset's own data.yaml if it has one."""
    import yaml
    for d in (src_root, os.path.dirname(src_root)):
        p = os.path.join(d, "data.yaml")
        if os.path.isfile(p):
            with open(p, encoding="utf-8") as f:
                names = (yaml.safe_load(f) or {}).get("names")
            if isinstance(names, list):
                return {i: n for i, n in enumerate(names)}
            if isinstance(names, dict):
                return {int(k): v for k, v in names.items()}
    return None


def write_data_yaml(path, names):
    lines = [
        "# Dataset config for training (YOLO format).",
        "# The class ORDER must match the label files (0,1 = first,second name below).",
        "# (train.py fills in the absolute dataset path automatically)",
        "train: train/images",
        "val: valid/images",
        "",
        "names:",
    ] + [f"  {i}: {n}" for i, n in sorted(names.items())]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="Folder of the extracted download")
    ap.add_argument("--dest", default=os.path.join(BASE_DIR, "dataset"))
    ap.add_argument("--val-split", type=float, default=0.1,
                    help="Fraction of train held out as validation when the download has no valid/ folder")
    ap.add_argument("--limit", type=int, default=0, help="Use only N training images (quick tests)")
    ap.add_argument("--move", action="store_true", help="Move files instead of copying (saves disk space)")
    ap.add_argument("--clean", action="store_true", help="Delete existing images/labels in dest first")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--append", action="store_true",
                    help="Add this dataset to the existing dataset/ instead of replacing it")
    ap.add_argument("--prefix", default="", help="Prefix for file names (use with --append, e.g. leak_)")
    ap.add_argument("--remap", default="",
                    help="Renumber classes, source:target. Water leak dataset with one class: 0:2")
    ap.add_argument("--names", default="",
                    help="Class names in order, e.g. smoke,fire,water_leak (written to data.yaml)")
    args = ap.parse_args()

    root = locate_root(args.src)
    if not root:
        sys.exit(f"[ERROR] Could not find a train/images + train/labels folder under {args.src}\n"
                 "Check that you extracted the download and pointed --src at the extracted folder.")
    print(f"Dataset root: {root}")

    # Safety: the source must not be (or be inside) the destination folder
    real_root, real_dest = os.path.realpath(root), os.path.realpath(args.dest)
    if real_root == real_dest or real_root.startswith(real_dest + os.sep) \
            or real_dest.startswith(real_root + os.sep):
        sys.exit("[ERROR] --src points at your own project/dataset folder, not at a downloaded dataset.\n"
                 "Download a dataset (e.g. D-Fire), extract it somewhere else (e.g. C:\\Downloads\\D-Fire),\n"
                 "then run:  python prepare_dataset.py --src C:\\Downloads\\D-Fire")

    train = find_split(root, ("train",))
    valid = find_split(root, ("valid", "val", "validation"))
    test = find_split(root, ("test",))

    remap = parse_remap(args.remap)
    for split in ("train", "valid", "test"):
        d = os.path.join(args.dest, split, "images")
        if args.append:
            break
        if os.path.isdir(d) and any(f.lower().endswith(IMG_EXTS) for f in os.listdir(d)):
            if args.clean:
                shutil.rmtree(os.path.join(args.dest, split))
            else:
                sys.exit(f"[ERROR] {d} already contains images. Use --clean to replace them.")

    random.seed(args.seed)
    train_pairs = list_pairs(*train)
    if not train_pairs:
        sys.exit(f"[ERROR] No images found in {train[0]}. Is the download complete and extracted?")
    random.shuffle(train_pairs)
    if args.limit:
        train_pairs = train_pairs[:args.limit]

    if valid:
        valid_pairs = list_pairs(*valid)
        if args.limit:
            valid_pairs = valid_pairs[:max(1, args.limit // 10)]
    else:
        n_val = max(1, int(len(train_pairs) * args.val_split))
        valid_pairs, train_pairs = train_pairs[:n_val], train_pairs[n_val:]
        print(f"No validation folder in the download: holding out {n_val} training images.")

    n_tr = put(train_pairs, args.dest, "train", args.move, args.prefix, remap)
    n_va = put(valid_pairs, args.dest, "valid", args.move, args.prefix, remap)
    n_te = put(list_pairs(*test), args.dest, "test", args.move, args.prefix, remap) if test and not args.limit else 0
    print(f"[OK] train: {n_tr} | valid: {n_va} | test: {n_te} -> {args.dest}")

    for split in ("train", "valid"):
        c = class_counts(os.path.join(args.dest, split, "labels"))
        print(f"  {split} boxes per class id: {dict(sorted(c.items()))}")

    data_yaml = os.path.join(args.dest, "data.yaml")
    if args.names:
        names = {i: n.strip() for i, n in enumerate(args.names.split(","))}
        write_data_yaml(data_yaml, names)
        print(f"[OK] Class names set: {names}")
    elif args.append:
        print("Appended. Existing dataset/data.yaml was kept - make sure it lists every class "
              "(or pass --names smoke,fire,water_leak).")
    elif (names := read_names(root)):
        write_data_yaml(data_yaml, names)
        print(f"[OK] Class names taken from the dataset's own data.yaml: {names}")
    else:
        names = None
        print("No data.yaml in the download; keeping dataset/data.yaml (0 = smoke, 1 = fire, "
              "which is the D-Fire order).")
    print("\nNext: python train.py   (see the first lines for image counts)")


if __name__ == "__main__":
    main()
