import json
import urllib.request
import os
import glob

url = os.environ["UPSTASH_URL"]
token = os.environ["UPSTASH_TOKEN"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def redis_get(key):
    req = urllib.request.Request(f"{url}/get/{key}", headers=headers)
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    raw = data.get("result")
    return json.loads(raw) if raw else []


def redis_set(key, value):
    body = json.dumps(value, ensure_ascii=False).encode()
    req = urllib.request.Request(f"{url}/set/{key}", data=body, headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


files = sorted(glob.glob(".github/announcements/*.json"))
if not files:
    print("No announcement files found")
    exit(0)

current = redis_get("sch:announcements")

file_anns = []
for f in sorted(files, reverse=True):
    ann = json.load(open(f, encoding="utf-8"))
    file_anns.append(ann)
    print(f"UPSERT: {ann['title']}")

file_ids = {a["id"] for a in file_anns}
rest = [a for a in current if a["id"] not in file_ids]
result_list = file_anns + rest
result = redis_set("sch:announcements", result_list)
print(f"Saved {len(result_list)} announcements. Result: {result}")
