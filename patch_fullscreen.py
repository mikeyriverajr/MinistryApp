import re

with open("src/pages/VisitForm.tsx", "r") as f:
    content = f.read()

# Make the map fullscreen cover the entire screen and fix z-index
old_div = "className={`w-full rounded-md overflow-hidden border border-gray-300 relative transition-all ${isMapFullscreen ? 'fixed top-0 left-0 right-0 bottom-0 z-[1000] h-screen w-screen m-0 rounded-none bg-white' : 'h-48 z-0'}`}"
new_div = "className={`w-full rounded-md overflow-hidden border border-gray-300 relative transition-all ${isMapFullscreen ? 'fixed inset-0 z-[9999] h-screen w-screen m-0 rounded-none bg-white' : 'h-48 z-0'}`}"

content = content.replace(old_div, new_div)

# Fix X button z-index
old_btn1 = "className=\"absolute top-4 right-4 z-[2000] bg-white p-3 rounded-full shadow-lg text-gray-700 hover:bg-gray-100 flex items-center justify-center border border-gray-300\""
new_btn1 = "className=\"absolute top-4 right-4 z-[10000] bg-white p-3 rounded-full shadow-lg text-gray-700 hover:bg-gray-100 flex items-center justify-center border border-gray-300\""

content = content.replace(old_btn1, new_btn1)

with open("src/pages/VisitForm.tsx", "w") as f:
    f.write(content)
