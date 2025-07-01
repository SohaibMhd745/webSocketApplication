provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_ssh_key" "default" {
  name       = "quiz-app-key"
  public_key = var.ssh_pub_key
}

resource "digitalocean_droplet" "web" {
  name              = var.droplet_name
  region            = var.region
  size              = var.size
  image             = "ubuntu-22-04-x64"
  ssh_keys          = [digitalocean_ssh_key.default.id]
  private_networking = true

  connection {
    type        = "ssh"
    user        = "root"
    private_key = file(var.ssh_key_path)
    host        = self.ipv4_address
  }

  provisioner "remote-exec" {
    inline = [
      "apt update",
      "apt install -y nodejs npm git",
      "git clone https://github.com/SohaibMhd745/webSocketApplication.git app",
      "cd app",
      "npm install",
      "npm run start &"
    ]
  }
}
