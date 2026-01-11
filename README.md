# bird-kiosk

Setup:

sudo apt update -y && sudo apt upgrade -y

flip display in GUI preferences

add this to /boot/firmware/cmdline.txt: fbcon=rotate:2 silent quiet loglevel=3 logo.nologo vt.global_cursor_default=
0

Add this to /boot/firmware/config.txt: disable_splash=1
