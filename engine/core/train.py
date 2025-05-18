import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
from datasets import Dataset
from transformers import (
    RobertaTokenizerFast,
    RobertaForSequenceClassification,
    Trainer,
    TrainingArguments,
)
import torch
import os
import zipfile
import shutil

ZIP_PATH = os.path.join("engine", "data", "processed_cyberbullying_dataset.zip")

EXTRACT_DIR = os.path.join("engine", "data")
with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
    zip_ref.extractall(EXTRACT_DIR)

DATA_DIR = os.path.join("engine", "data", "processed_cyberbullying_dataset.csv")
assert os.path.exists(DATA_DIR, f"Data file not found: {DATA_DIR}")

MODEL_DIR = os.path.join("engine", "core", "model")

df = pd.read_csv(DATA_DIR)
df = df[["text", "binary_label"]]
df["label"] = df["binary_label"].map({"not_cyberbullying": 0, "cyberbullying": 1})

tokenizer = RobertaTokenizerFast.from_pretrained("roberta-base")

def tokenize(example):
    return tokenizer(example["text"], truncation=True, padding="max_length", max_length=128)

train_texts, val_texts = train_test_split(df, test_size=0.2, stratify=df["label"], random_state=42)
train_ds = Dataset.from_pandas(train_texts[["text", "label"]])
val_ds = Dataset.from_pandas(val_texts[["text", "label"]])
train_ds = train_ds.map(tokenize, batched=True)
val_ds = val_ds.map(tokenize, batched=True)
train_ds.set_format("torch", columns=["input_ids", "attention_mask", "label"])
val_ds.set_format("torch", columns=["input_ids", "attention_mask", "label"])

model = RobertaForSequenceClassification.from_pretrained("roberta-base", num_labels=2)

class_counts = df["label"].value_counts().sort_index().values
total = class_counts.sum()
weights = torch.tensor([total / (2 * c) for c in class_counts], dtype=torch.float)

from transformers import Trainer

class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        loss_fn = torch.nn.CrossEntropyLoss(weight=weights.to(logits.device))
        loss = loss_fn(logits, labels)
        return (loss, outputs) if return_outputs else loss

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = logits.argmax(-1)
    return {
        "accuracy": accuracy_score(labels, preds),
        "f1": f1_score(labels, preds, average="weighted")
    }

training_args = TrainingArguments(
    output_dir=MODEL_DIR,
    eval_strategy="epoch",
    logging_dir="logs",
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    num_train_epochs=3,
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss"
)

trainer = WeightedTrainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
)

trainer.train()

if os.path.exists(MODEL_DIR):
    shutil.rmtree(MODEL_DIR)
    
model.config.id2label = {0: "not_cyberbullying", 1: "cyberbullying"}
model.config.label2id = {"not_cyberbullying": 0, "cyberbullying": 1}

model.save_pretrained(MODEL_DIR)
tokenizer.save_pretrained(MODEL_DIR)