import base64
import re
import os

try:
    if not os.path.exists('logo.png'):
        print("Error: logo.png not found in this folder!")
        exit()

    with open('logo.png', 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    data_uri = f"data:image/png;base64,{b64}"
    
    for filename in ['index.html', 'dashboard.html']:
        if not os.path.exists(filename): continue
        
        with open(filename, 'r') as f:
            content = f.read()
        
        # 1. Replace the standard img tag
        content = content.replace('<img src="logo.png" class="nav-logo">', f'<img src="{data_uri}" class="nav-logo">')
        content = content.replace('<img src="logo.png" class="hero-logo">', f'<img src="{data_uri}" class="hero-logo">')
        
        # 2. Replace the fallback SVG block if it exists
        content = re.sub(r'<div class="logo-container">.*?</div>', f'<div class="logo-container"><img src="{data_uri}" class="nav-logo"> HYNA-Stage</div>', content, flags=re.DOTALL)
        
        with open(filename, 'w') as f:
            f.write(content)
            
    print("✅ Success! Logo baked directly into index.html and dashboard.html")
except Exception as e:
    print(f"Error: {e}")
