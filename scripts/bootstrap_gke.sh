#!/bin/bash
# =============================================================================
# bootstrap_gke.sh — One-time cluster bootstrap for SEONDAL Pay on GKE
#
# Does what cannot live in Git:
#   1. Creates the `seondal-secrets` K8s Secret from LOCAL credential files
#      (gcp-key.json / merchant-keypair.json / .env — never committed)
#   2. Installs ArgoCD into the cluster
#   3. Applies the ArgoCD root Application (app-of-apps) → full GitOps
#
# Prereqs: gcloud + kubectl authenticated to the target cluster.
# =============================================================================
set -euo pipefail

NAMESPACE_APP="seondal"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "${SCRIPT_DIR}")"

echo "=== [1/4] Verifying cluster access ==="
kubectl cluster-info | head -1

echo "=== [2/4] Creating seondal-secrets (from local files, never committed) ==="
kubectl create namespace "${NAMESPACE_APP}" --dry-run=client -o yaml | kubectl apply -f -

SECRET_ARGS=()
if [[ -f "${REPO_ROOT}/gcp-key.json" ]]; then
  SECRET_ARGS+=(--from-file=gcp-key.json="${REPO_ROOT}/gcp-key.json")
  echo "  + gcp-key.json"
else
  echo "  - gcp-key.json not found (app will use mock GCS/Firestore)"
fi
if [[ -f "${REPO_ROOT}/merchant-keypair.json" ]]; then
  SECRET_ARGS+=(--from-file=merchant-keypair.json="${REPO_ROOT}/merchant-keypair.json")
  echo "  + merchant-keypair.json"
else
  echo "  - merchant-keypair.json not found (a fresh merchant wallet is generated per pod)"
fi
# Optional runtime env overrides (DB_HOST, DB_USER, DB_PASSWORD, KIMI_API_KEY, ...)
if [[ -f "${REPO_ROOT}/.env" ]]; then
  SECRET_ARGS+=(--from-env-file="${REPO_ROOT}/.env")
  echo "  + .env"
fi

if [[ ${#SECRET_ARGS[@]} -gt 0 ]]; then
  kubectl create secret generic seondal-secrets "${SECRET_ARGS[@]}" \
    --namespace "${NAMESPACE_APP}" --dry-run=client -o yaml | kubectl apply -f -
else
  echo "  (no local secrets — skipping secret creation; mock backends will be used)"
fi

# Discord webhook secret for Alertmanager (infra alerts) — from .env or shell.
# Discord webhooks expose a Slack-compatible endpoint by appending /slack.
if [[ -z "${DISCORD_WEBHOOK_URL:-}" && -f "${REPO_ROOT}/.env" ]]; then
  DISCORD_WEBHOOK_URL="$(grep -E '^DISCORD_WEBHOOK_URL=' "${REPO_ROOT}/.env" | cut -d= -f2- | tr -d '"'"'" || true)"
fi
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
  SLACK_COMPAT_URL="${DISCORD_WEBHOOK_URL%/}/slack"
  kubectl create secret generic alert-discord-webhook \
    --from-literal=discord-webhook-url="${SLACK_COMPAT_URL}" \
    --namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
  echo "  + alert-discord-webhook (Alertmanager → Discord, /slack-compatible)"
else
  echo "  - DISCORD_WEBHOOK_URL not set — Alertmanager will have no receiver (app-level Discord alerts also disabled)"
fi

echo "=== [3/4] Installing ArgoCD ==="
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
echo "Waiting for argocd-server to be ready..."
kubectl rollout status deployment/argocd-server -n argocd --timeout=300s

# Expose ArgoCD UI publicly for evaluators (demo; use Ingress+auth in prod)
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}' || true

echo "=== [4/4] Applying ArgoCD root Application (app-of-apps) ==="
kubectl apply -f "${REPO_ROOT}/argocd/root-application.yaml"

echo
echo "======================================================================"
echo "🎉 Bootstrap complete. ArgoCD now syncs: seondal-pay, monitoring stack"
echo
echo "  ArgoCD UI:     kubectl get svc argocd-server -n argocd"
echo "  ArgoCD admin:  kubectl -n argocd get secret argocd-initial-admin-secret \\"
echo "                   -o jsonpath='{.data.password}' | base64 -d; echo"
echo "  Grafana:       kubectl get svc -n monitoring kube-prometheus-stack-grafana"
echo "                 (login: admin / seondal-admin — demo credential)"
echo "  App endpoint:  kubectl get svc -n seondal seondal-pay"
echo "======================================================================"
