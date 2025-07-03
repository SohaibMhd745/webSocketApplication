variable "do_token" {
  description = "Token d'accès à l'API DigitalOcean"
  type        = string
}

variable "ssh_key_path" {
  description = "Chemin absolu ou relatif vers la clé privée SSH"
  type        = string
}

variable "droplet_name" {
  description = "Nom du droplet"
  type        = string
  default     = "quiz-app"
}

variable "region" {
  description = "Région DigitalOcean"
  type        = string
  default     = "fra1"
}

variable "size" {
  description = "Taille du droplet"
  type        = string
  default     = "s-1vcpu-1gb"
}