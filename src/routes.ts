export function buildBaseUrl(docset: string, version: string): string {
  return `https://run-ai-docs.nvidia.com/${docset}/${version}`;
}

export const helmInstallRoutes: Record<string, string> = {
  "control-plane": "getting-started/installation/install-using-helm/install-control-plane",
  cluster: "getting-started/installation/install-using-helm/helm-install",
  preparations: "getting-started/installation/install-using-helm/preparations",
  upgrade: "getting-started/installation/install-using-helm/upgrade",
  uninstall: "getting-started/installation/install-using-helm/uninstall",
};

export const systemRequirementsRoutes: Record<string, string> = {
  "support-matrix": "getting-started/installation/support-matrix",
  "control-plane-requirements": "getting-started/installation/install-using-helm/cp-system-requirements",
  "cluster-requirements": "getting-started/installation/install-using-helm/system-requirements",
  network: "getting-started/installation/install-using-helm/network-requirements",
};

export const rbacRoutes: Record<string, string> = {
  overview: "infrastructure-setup/authentication/overview",
  roles: "infrastructure-setup/authentication/roles",
  "access-rules": "infrastructure-setup/authentication/accessrules",
  "service-accounts": "infrastructure-setup/authentication/service-accounts",
  "cluster-auth": "infrastructure-setup/authentication/cluster-authentication",
};

export const workloadRoutes: Record<string, string> = {
  introduction: "workloads-in-nvidia-run-ai/introduction-to-workloads",
  "workloads-overview": "workloads-in-nvidia-run-ai/workloads",
  "workload-types": "workloads-in-nvidia-run-ai/workload-types",
  "native-workloads": "workloads-in-nvidia-run-ai/workload-types/native-workloads",
  "supported-workload-types": "workloads-in-nvidia-run-ai/workload-types/supported-workload-types",
  "supported-features": "workloads-in-nvidia-run-ai/workload-types/supported-features",
  "extending-workload-support": "workloads-in-nvidia-run-ai/workload-types/extending-workload-support",
  "submit-via-yaml": "workloads-in-nvidia-run-ai/submit-via-yaml",
  "workload-templates": "workloads-in-nvidia-run-ai/workload-templates",
  "using-workspaces": "workloads-in-nvidia-run-ai/using-workspaces",
  "using-training": "workloads-in-nvidia-run-ai/using-training",
  "train-models": "workloads-in-nvidia-run-ai/using-training/train-models",
  "distributed-training": "workloads-in-nvidia-run-ai/using-training/distributed-training-models",
  "using-inference": "workloads-in-nvidia-run-ai/using-inference",
  "inference-overview": "workloads-in-nvidia-run-ai/using-inference/nvidia-run-ai-inference-overview",
  "custom-inference": "workloads-in-nvidia-run-ai/using-inference/custom-inference",
  "nim-inference": "workloads-in-nvidia-run-ai/using-inference/nim-inference",
  "hugging-face-inference": "workloads-in-nvidia-run-ai/using-inference/hugging-face-inference",
  "assets-overview": "workloads-in-nvidia-run-ai/assets/overview",
  environments: "workloads-in-nvidia-run-ai/assets/environments",
  "compute-resources": "workloads-in-nvidia-run-ai/assets/compute-resources",
  datasources: "workloads-in-nvidia-run-ai/assets/datasources",
  credentials: "workloads-in-nvidia-run-ai/assets/credentials",
  "data-volumes": "workloads-in-nvidia-run-ai/assets/data-volumes",
  "ai-applications": "ai-applications/ai-applications",
};

export const schedulerRoutes: Record<string, string> = {
  "how-it-works": "platform-management/runai-scheduler/scheduling/how-the-scheduler-works",
  "concepts-and-principles": "platform-management/runai-scheduler/scheduling/concepts-and-principles",
  "workload-priority-control": "platform-management/runai-scheduler/scheduling/workload-priority-control",
  "default-scheduler": "platform-management/runai-scheduler/scheduling/default-scheduler",
  fractions: "platform-management/runai-scheduler/resource-optimization/fractions",
  "dynamic-fractions": "platform-management/runai-scheduler/resource-optimization/dynamic-fractions",
  "time-slicing": "platform-management/runai-scheduler/resource-optimization/time-slicing",
  "node-level-scheduler": "platform-management/runai-scheduler/resource-optimization/node-level-scheduler",
  "memory-swap": "platform-management/runai-scheduler/resource-optimization/memory-swap",
  "dynamic-fractions-quickstart": "platform-management/runai-scheduler/resource-optimization/quick-starts/dynamic-gpu-fractions-quickstart",
};

export const cliRoutes: Record<string, string> = {
  install: "reference/cli/install-cli",
  overview: "reference/cli/runai",
  auth: "reference/cli/runai/runai_auth",
  login: "reference/cli/runai/runai_login",
  logout: "reference/cli/runai/runai_logout",
  config: "reference/cli/runai/runai_config",
  whoami: "reference/cli/runai/runai_whoami",
  kubeconfig: "reference/cli/runai/runai_kubeconfig",
  training: "reference/cli/runai/runai_training",
  inference: "reference/cli/runai/runai_inference",
  "inference-describe": "reference/cli/runai/runai_inference_describe",
  workload: "reference/cli/runai/runai_workload",
  workspace: "reference/cli/runai/runai_workspace",
  pytorch: "reference/cli/runai/runai_pytorch",
  mpi: "reference/cli/runai/runai_mpi",
  tensorflow: "reference/cli/runai/runai_tensorflow",
  jax: "reference/cli/runai/runai_jax",
  xgboost: "reference/cli/runai/runai_xgboost",
  cluster: "reference/cli/runai/runai_cluster",
  node: "reference/cli/runai/runai_node",
  nodepool: "reference/cli/runai/runai_nodepool",
  project: "reference/cli/runai/runai_project",
  compute: "reference/cli/runai/runai-compute",
  datasource: "reference/cli/runai/runai-datasource",
  department: "reference/cli/runai/runai-department",
  environment: "reference/cli/runai/runai-environment",
  template: "reference/cli/runai/runai-template",
  pvc: "reference/cli/runai/runai_pvc",
  diagnostics: "reference/cli/runai/runai-diagnostics",
  version: "reference/cli/runai/runai_version",
  upgrade: "reference/cli/runai/runai_upgrade",
  report: "reference/cli/runai/runai_report",
};

export const policyRoutes: Record<string, string> = {
  "policies-and-rules": "platform-management/policies/policies-and-rules",
  "workload-policies": "platform-management/policies/workload-policies",
  "scheduling-rules": "platform-management/policies/scheduling-rules",
  "policy-yaml-reference": "platform-management/policies/policy-yaml-reference",
  "policy-yaml-examples": "platform-management/policies/policy-yaml-examples",
};

export const apiCategoryRoutes: Record<string, string> = {
  clusters: "organizations/clusters",
  departments: "organizations/departments",
  projects: "organizations/projects",
  nodepools: "organizations/nodepools",
  nodes: "organizations/nodes",
  tenant: "organizations/tenant",
  "access-rules": "authentication-and-authorization/access-rules",
  "access-keys": "authentication-and-authorization/access-keys",
  roles: "authentication-and-authorization/roles",
  users: "authentication-and-authorization/users",
  "service-accounts": "authentication-and-authorization/service-accounts",
  applications: "authentication-and-authorization/applications",
  permissions: "authentication-and-authorization/permissions",
  tokens: "authentication-and-authorization/tokens",
  idps: "authentication-and-authorization/idps",
  "org-unit": "authentication-and-authorization/org-unit",
};
