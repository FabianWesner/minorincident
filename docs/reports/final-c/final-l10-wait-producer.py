import time,subprocess
from pathlib import Path
while not Path('test-results/final-c/native-first3-done.flag').exists():time.sleep(1)
subprocess.run(['python3','docs/reports/final-c/final-l10-producer.py'],check=True)
Path('test-results/final-c/native-all-done.flag').touch()
