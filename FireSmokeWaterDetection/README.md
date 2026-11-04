# FireDetection

## Setup
    pip install -r requirements.txt

## Add your files
- Replace `best.pt` with your real trained YOLO weights (fire / smoke classes)
- Optional: put images in `images/` and videos in `videos/` for batch testing

## A) Live camera in the browser
    python app.py
Double-click `start.bat` (or run `python app.py`): the server starts and the page opens automatically.
Click "Start camera". Use `python app.py --no-browser` to stop the auto-open.
If you host web/index.html elsewhere (e.g. Visual Studio), keep `python app.py` running and
set the "Server" box on the page to http://localhost:5000 (or open the page with ?api=http://localhost:5000).
(Options: --port 8000, --conf 0.3, --host 0.0.0.0 for other devices on your LAN.
 Phones/other PCs need HTTPS to use the camera; localhost works without it.)

## B) Batch test on files
    python test_model.py
Results go to `output/images/` and `output/videos/`.

## Train your own model
1. Put a YOLO-format dataset in `dataset/` (see `dataset/data.yaml`; check the class order!)
2. `python train.py`   (needs a GPU; or train on Google Colab and download `best.pt`)
    python train.py --model yolo26n.pt --epochs 30 --batch 8
3. The new `best.pt` is copied to the project root automatically.


python prepare_dataset.py --src C:\Downloads\D-Fire\dataset --limit 3000 --clean
python train.py --model yolo26n.pt --epochs 30 --batch 8

python prepare_dataset.py --src C:\Downloads\water-leak --append --prefix leak_ --remap 0:2 --names smoke,fire,water_leak


I’ve fixed prepare_dataset.py and rebuilt the zip. I tested the new checks on made-up folders, including your exact mistake, and each now fails with a clear message and no files lost.

The script now refuses to run if --src points at your project or dataset folder, and it stops with an error if the source folder contains no images. Nothing of yours was lost in the run you did, since your dataset folders were empty.

The real step still missing is the dataset itself, because there are no images on your PC yet.

Download a dataset. Go to github.com/gaia-solutions-on-demand/DFireDataset and use its link for the pre-split training, validation and test sets. Alternatively, use the D-Fire project on Roboflow Universe (universe.roboflow.com/uweeaai/d-fire-ehbj2) and download it in a YOLO format.
Extract it somewhere outside your project, for example C:\Downloads\D-Fire. Open that folder and check that it contains train (and probably test), each with images and labels inside.
Run the script with that folder:
   python prepare_dataset.py --src C:\Downloads\D-Fire --limit 3000 --clean
Check the output. It should say something like train: 2700 | valid: 300 with non-zero box counts for both class ids. If the numbers are zero, don’t train yet.
Train:
   python train.py --model yolo26n.pt --epochs 30 --batch 8

If step 2 doesn’t match what you see, paste the output of dir C:\Downloads\D-Fire and I’ll adjust the script to your layout.

https://app.roboflow.com/chester-tan-gub30/d-fire-ehbj2-b4nzz/train