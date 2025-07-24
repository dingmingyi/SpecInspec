# Stellar Spectrum Visual Inspector

A web-based tool for human inspection of stellar spectra with labeling capabilities.

## Features

- Interactive visualization of stellar spectra
- Simple labeling interface
- CSV-based catalog management
- Local-first design (no database required)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/dingmingyi/SpecInspec.git
   cd SpecInspec
   ```

2. Install dependencies:
   ```bash
   pip install flask pillow
   ```

## Usage

### Basic Startup
```bash
python app.py --star-table catalog/test.csv -p 5000
```

Then open your browser to:
```
http://localhost:5000
```

### Command Line Options
| Option | Description | Default |
|--------|-------------|---------|
| `-p`, `--port` | Port to run the server | `5000` |
| `--star-table` | Path to star catalog CSV | `catalog/sample.csv` |

### Catalog File Format
Your star catalog CSV should contain at minimum:
```csv
obsid,label,notes,tag
1001,,,0
1002,,,0
...
```

### Spectrum Plot Requirements
- Place plots in the specified data directory
- Naming convention: `{obsid}_Li_region.png` and `{obsid}_Halpha_region.png`
- Supported formats: PNG, JPG

## Development Notes

### Current Limitations
⚠️ **Pre-generated plots only**: The current version requires:
1. Spectrum plots to be pre-generated and saved in the data directory
2. Matching `obsid` values between catalog and filenames

### Roadmap
- [ ] On-the-fly spectrum generation
- [ ] User defined LABEL / NOTES
- [ ] Pre-settings

## Troubleshooting

**Port already in use?**
```bash
python app.py -p 5001  # Try a different port
```

**Missing plots?**
Verify:
1. Files exist in the data directory
2. Filenames match catalog obsids exactly
3. File permissions are correct

---
