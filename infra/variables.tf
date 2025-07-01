variable "do_token" {
  type = string
}

variable "ssh_key_path" {
  type = string
}

variable "ssh_pub_key" {
  type = string
}

variable "droplet_name" {
  type    = string
  default = "quiz-app"
}

variable "region" {
  type    = string
  default = "fra1"
}

variable "size" {
  type    = string
  default = "s-1vcpu-1gb"
}
