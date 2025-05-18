import os
from transformers import RobertaForSequenceClassification, RobertaTokenizerFast
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

model = RobertaForSequenceClassification.from_pretrained(MODEL_DIR)

tokenizer = RobertaTokenizerFast.from_pretrained("roberta-base")

model.config.id2label = {0: "not_cyberbullying", 1: "cyberbullying"}
model.config.label2id = {"not_cyberbullying": 0, "cyberbullying": 1}

if os.path.exists(MODEL_DIR):
    shutil.rmtree(MODEL_DIR)

model.save_pretrained(MODEL_DIR)
tokenizer.save_pretrained(MODEL_DIR)