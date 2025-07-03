terraform {
  required_version = ">= 1.0.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

locals {
  ssh_pub_key = file("~/.ssh/id_rsa.pub")
}

resource "digitalocean_ssh_key" "default" {
  name       = "quiz-app-key"
  public_key = local.ssh_pub_key
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
}
