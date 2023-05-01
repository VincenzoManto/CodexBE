import base64
import mysql.connector
import os
import sys
from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
import torch
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

model = VisionEncoderDecoderModel.from_pretrained("nlpconnect/vit-gpt2-image-captioning")
feature_extractor = ViTImageProcessor.from_pretrained("nlpconnect/vit-gpt2-image-captioning")
tokenizer = AutoTokenizer.from_pretrained("nlpconnect/vit-gpt2-image-captioning")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

from dotenv import load_dotenv
from pathlib import Path
error = 0
dotenv_path = Path(os.path.abspath(__file__) + '../.env')
load_dotenv()


max_length = 20
num_beams = 8
gen_kwargs = {"max_length": max_length, "num_beams": num_beams}
def predict_step(image_paths):
  images = []
  for image_path in image_paths:
    i_image = Image.open(image_path)
    if i_image.mode != "RGB":
      i_image = i_image.convert(mode="RGB")

    images.append(i_image)

  pixel_values = feature_extractor(images=images, return_tensors="pt").pixel_values
  pixel_values = pixel_values.to(device)

  output_ids = model.generate(pixel_values, **gen_kwargs)

  preds = tokenizer.batch_decode(output_ids, skip_special_tokens=True)
  preds = [pred.strip() for pred in preds]
  return preds


mydb = mysql.connector.connect(
    host=os.getenv("CODEX_DB_HOST"),
    user=os.getenv("CODEX_DB_USER"),
    password=os.getenv("CODEX_DB_PASS"),
    database=os.getenv("CODEX_DB_NAME")
)



mycursor = mydb.cursor(dictionary=True, buffered=True)

db = int(sys.argv[1])

mycursor.execute("SELECT * FROM `db` WHERE id = %s", (int(db),))

connection = mycursor.fetchone()


if connection['type'] == 'mysql':
    conn = mysql.connector.connect(
      host=connection['server'],
      user=connection['username'],
      password=connection['password'],
      database=connection['name']
    )
    cursor = conn.cursor(dictionary=True)

    table = sys.argv[2]
    column = sys.argv[3]
    cursor.execute("SELECT * FROM " + table)
    images = cursor.fetchall()
    i = 0
    for image in images:
        fh = open(os.path.dirname(__file__) + '\\..\\temp\\' + str(i) + ".png", "wb")
        fh.write(image[column])
        fh.close()
        image['codeximage'] = predict_step([os.path.dirname(__file__) + '\\..\\temp\\' + str(i) + ".png"])[0]
        image[column] = (base64.b64encode(image[column])).decode('utf-8')
        i = i + 1
    
    import pandas as pd
    pd.DataFrame(images).to_json(os.path.dirname(__file__) + '\\..\\persistent\\' + str(db) + "." + table + ".mat")
        