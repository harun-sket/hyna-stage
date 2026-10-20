# ⚡ HynaStage

**Ephemeral Firecracker MicroVMs in 5 seconds. Built on a $150 Android phone.**

AI agents write code in seconds, but provisioning staging environments takes minutes. HynaStage is a CLI that spins up isolated E2B sandboxes, deploys your HTML/code, and returns a live URL instantly. They auto-destroy after 1 hour to save costs.

## 🚀 Quick Start

```bash
npm install -g @hynaweb/stage
hyna-stage up -f index.html --key=hyna_your_api_key
