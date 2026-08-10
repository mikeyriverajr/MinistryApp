import re

with open("src/pages/VisitForm.tsx", "r") as f:
    content = f.read()

# Make the map fullscreen cover the entire screen reliably
old_div = "className={`w-full rounded-md overflow-hidden border border-gray-300 relative transition-all ${isMapFullscreen ? 'fixed top-0 left-0 right-0 bottom-0 z-[99999] h-dvh w-dvw m-0 rounded-none bg-white' : 'h-48 z-0'}`}"
new_div = "className={isMapFullscreen ? 'fixed inset-0 z-[99999] bg-white m-0 p-0 rounded-none w-screen h-screen max-w-none max-h-none' : 'w-full h-48 rounded-md overflow-hidden border border-gray-300 relative z-0'}"

content = content.replace(old_div, new_div)

with open("src/pages/VisitForm.tsx", "w") as f:
    f.write(content)
