REPO="/Users/Shared/dev/street-sweeper-13"

sudo chflags -R nouchg,noschg "$REPO"
sudo chmod  -RN "$REPO"
sudo chown  -R $(whoami):devgroup "$REPO"
sudo chmod  -R ug+rwX "$REPO"
sudo find "$REPO" -type d -exec chmod g+s {} \;
