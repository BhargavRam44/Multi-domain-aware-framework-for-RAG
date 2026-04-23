# Installation Guide

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Internet connection for API calls

## Step-by-Step Installation

### 1. Upgrade pip and setuptools (Important!)

Before installing dependencies, upgrade your pip and setuptools:

```bash
python -m pip install --upgrade pip setuptools wheel
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Your Gemini API Key

The API key is already hardcoded in `app.py`, but you can also set it as an environment variable:

**Windows:**
```bash
```

**Linux/Mac:**
```bash
export GEMINI_API_KEY=AIzaSyB7mQq8Ag5zqGG3T3Pe6iqP-PaKzC4MRe4
```

### 4. Run the Application

```bash
python app.py
```

### 5. Open in Browser

Navigate to: `http://localhost:5000`

## Troubleshooting

### Error: "Cannot import 'setuptools.build_meta'"

**Solution:**
```bash
python -m pip install --upgrade pip setuptools wheel
pip install --upgrade setuptools
```

### Error: "Microsoft Visual C++ 14.0 or greater is required" (Windows)

This happens with numpy installation on Windows.

**Solution 1 - Use pre-built wheels:**
```bash
pip install numpy --only-binary :all:
```

**Solution 2 - Install from conda (if you have Anaconda):**
```bash
conda install numpy flask flask-cors requests pypdf2
```

### Error: "No module named 'flask'"

**Solution:**
```bash
pip install Flask flask-cors
```

### Error: Port 5000 already in use

**Windows:**
```bash
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

**Linux/Mac:**
```bash
lsof -ti:5000 | xargs kill -9
```

Or change the port in `app.py`:
```python
app.run(debug=True, host='0.0.0.0', port=5001)  # Changed to 5001
```

### Error: "Failed to extract text from PDF"

**Solution:**
- Ensure your PDF contains actual text (not just images)
- Try a different PDF file
- Check if the PDF is password-protected

### Error: Gemini API rate limit exceeded

**Solution:**
- Wait a few minutes before retrying
- The free tier has usage limits
- Consider upgrading your Gemini API plan

## Alternative Installation Methods

### Method 1: Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

### Method 2: Conda Environment

```bash
# Create conda environment
conda create -n rag-system python=3.10

# Activate it
conda activate rag-system

# Install dependencies
conda install flask numpy requests
pip install flask-cors PyPDF2

# Run the app
python app.py
```

### Method 3: Install packages individually

If the requirements.txt fails, install one by one:

```bash
pip install setuptools wheel
pip install Flask
pip install flask-cors
pip install PyPDF2
pip install numpy
pip install requests
```

## Verifying Installation

After installation, verify all packages are installed:

```bash
pip list
```

You should see:
- Flask
- flask-cors
- PyPDF2
- numpy
- requests

## System Requirements

- **RAM:** Minimum 2GB (4GB+ recommended for large PDFs)
- **Storage:** 100MB for application + space for data files
- **Python:** 3.8, 3.9, 3.10, 3.11, or 3.12

## Getting Help

If you encounter other issues:

1. Check Python version: `python --version`
2. Check pip version: `pip --version`
3. Try upgrading all packages: `pip install --upgrade -r requirements.txt`
4. Clear pip cache: `pip cache purge`
5. Reinstall from scratch in a fresh virtual environment
