import re

with open("src/pages/VisitForm.tsx", "r") as f:
    content = f.read()

# Make the map fullscreen cover the entire screen by taking it OUT of document flow when active
old_div = "className={`w-full rounded-md overflow-hidden border border-gray-300 relative transition-all ${isMapFullscreen ? 'fixed inset-0 z-[9999] h-screen w-screen m-0 rounded-none bg-white' : 'h-48 z-0'}`}"
new_div = "className={`w-full rounded-md overflow-hidden border border-gray-300 relative transition-all ${isMapFullscreen ? 'fixed top-0 left-0 right-0 bottom-0 z-[99999] h-dvh w-dvw m-0 rounded-none bg-white' : 'h-48 z-0'}`}"

content = content.replace(old_div, new_div)

with open("src/pages/VisitForm.tsx", "w") as f:
    f.write(content)
