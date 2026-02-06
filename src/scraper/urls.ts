const BASE = "https://run-ai-docs.nvidia.com";
export const VERSION_TOKEN = "__VERSION__";

export interface DocPage {
  url: string;
  category: string;
  subcategory: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Installation & Getting Started
// ---------------------------------------------------------------------------
export const SELF_HOSTED_INSTALL: DocPage[] = [
  // Support matrix & requirements
  { url: `${BASE}/self-hosted/getting-started/installation/support-matrix`, category: "installation", subcategory: "requirements", title: "Support Matrix" },
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/cp-system-requirements`, category: "installation", subcategory: "requirements", title: "Control Plane System Requirements" },
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/system-requirements`, category: "installation", subcategory: "requirements", title: "Cluster System Requirements" },
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/network-requirements`, category: "installation", subcategory: "requirements", title: "Network Requirements" },

  // Preparations & install
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/preparations`, category: "installation", subcategory: "helm", title: "Installation Preparations" },
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/install-control-plane`, category: "installation", subcategory: "helm", title: "Install Control Plane" },
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/helm-install`, category: "installation", subcategory: "helm", title: "Install Cluster" },
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/upgrade`, category: "installation", subcategory: "helm", title: "Upgrade" },
  { url: `${BASE}/self-hosted/getting-started/installation/install-using-helm/uninstall`, category: "installation", subcategory: "helm", title: "Uninstall" },

  // What's new
  { url: `${BASE}/self-hosted/getting-started/whats-new/whats-new-2-24`, category: "installation", subcategory: "release-notes", title: "What's New in 2.24" },
  { url: `${BASE}/self-hosted/getting-started/whats-new/hotfixes-for-version-2.24`, category: "installation", subcategory: "release-notes", title: "Hotfixes for 2.24" },
];

// ---------------------------------------------------------------------------
// Infrastructure Setup (authentication, configuration, procedures)
// ---------------------------------------------------------------------------
export const SELF_HOSTED_INFRA: DocPage[] = [
  // Authentication & RBAC
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/overview`, category: "infrastructure", subcategory: "authentication", title: "Authentication Overview" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/users`, category: "infrastructure", subcategory: "authentication", title: "Users" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/roles`, category: "infrastructure", subcategory: "authentication", title: "Roles" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/service-accounts`, category: "infrastructure", subcategory: "authentication", title: "Service Accounts" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/accessrules`, category: "infrastructure", subcategory: "authentication", title: "Access Rules" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/cluster-authentication`, category: "infrastructure", subcategory: "authentication", title: "Cluster Authentication" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/sso/saml`, category: "infrastructure", subcategory: "authentication", title: "SSO - SAML" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/sso/openidconnect`, category: "infrastructure", subcategory: "authentication", title: "SSO - OpenID Connect" },
  { url: `${BASE}/self-hosted/infrastructure-setup/authentication/sso/openshift`, category: "infrastructure", subcategory: "authentication", title: "SSO - OpenShift" },

  // Advanced setup
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/control-plane-config`, category: "infrastructure", subcategory: "configuration", title: "Control Plane Configuration" },
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/cluster-config`, category: "infrastructure", subcategory: "configuration", title: "Cluster Configuration" },
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/node-roles`, category: "infrastructure", subcategory: "configuration", title: "Node Roles" },
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/security-best-practices`, category: "infrastructure", subcategory: "configuration", title: "Security Best Practices" },
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/container-access/external-access-to-containers`, category: "infrastructure", subcategory: "configuration", title: "External Access to Containers" },
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/container-access/user-identity-in-containers`, category: "infrastructure", subcategory: "configuration", title: "User Identity in Containers" },
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/integrations`, category: "infrastructure", subcategory: "integrations", title: "Integrations Overview" },
  { url: `${BASE}/self-hosted/infrastructure-setup/advanced-setup/integrations/karpenter`, category: "infrastructure", subcategory: "integrations", title: "Karpenter Integration" },

  // Procedures
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/clusters`, category: "infrastructure", subcategory: "procedures", title: "Cluster Management" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/secure-your-cluster`, category: "infrastructure", subcategory: "procedures", title: "Secure Your Cluster" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/monitoring`, category: "infrastructure", subcategory: "procedures", title: "Monitoring" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/high-availability`, category: "infrastructure", subcategory: "procedures", title: "High Availability" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/shared-storage`, category: "infrastructure", subcategory: "procedures", title: "Shared Storage" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/event-history`, category: "infrastructure", subcategory: "procedures", title: "Event History" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/system-monitoring`, category: "infrastructure", subcategory: "procedures", title: "System Monitoring" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/logs-collection`, category: "infrastructure", subcategory: "procedures", title: "Logs Collection" },
  { url: `${BASE}/self-hosted/infrastructure-setup/procedures/cluster-restore`, category: "infrastructure", subcategory: "procedures", title: "Cluster Restore" },
];

// ---------------------------------------------------------------------------
// Platform Management (org structure, resources, monitoring, policies)
// ---------------------------------------------------------------------------
export const PLATFORM_MANAGEMENT: DocPage[] = [
  // AI Initiatives (org structure)
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/adapting-ai-initiatives`, category: "platform", subcategory: "organization", title: "Adapting AI Initiatives" },
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/organization/projects`, category: "platform", subcategory: "organization", title: "Projects" },
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/organization/departments`, category: "platform", subcategory: "organization", title: "Departments" },
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/resources/nodes`, category: "platform", subcategory: "resources", title: "Nodes" },
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/resources/node-pools`, category: "platform", subcategory: "resources", title: "Node Pools" },
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/resources/mig-profiles`, category: "platform", subcategory: "resources", title: "MIG Profiles" },
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/resources/topology-aware-scheduling`, category: "platform", subcategory: "resources", title: "Topology-Aware Scheduling" },
  { url: `${BASE}/self-hosted/platform-management/aiinitiatives/resources/using-gb200`, category: "platform", subcategory: "resources", title: "Using GB200 NVL72" },

  // Monitoring & performance
  { url: `${BASE}/self-hosted/platform-management/monitor-performance/before-you-start`, category: "platform", subcategory: "monitoring", title: "Monitoring - Before You Start" },
  { url: `${BASE}/self-hosted/platform-management/monitor-performance/metrics`, category: "platform", subcategory: "monitoring", title: "Metrics" },
  { url: `${BASE}/self-hosted/platform-management/monitor-performance/gpu-profiling-metrics`, category: "platform", subcategory: "monitoring", title: "GPU Profiling Metrics" },
  { url: `${BASE}/self-hosted/platform-management/monitor-performance/workload-categories`, category: "platform", subcategory: "monitoring", title: "Workload Categories" },

  // Settings
  { url: `${BASE}/self-hosted/settings/general-settings`, category: "platform", subcategory: "settings", title: "General Settings" },
  { url: `${BASE}/self-hosted/settings/general-settings/notifications`, category: "platform", subcategory: "settings", title: "Notifications" },
  { url: `${BASE}/self-hosted/settings/user-settings/user-credentials`, category: "platform", subcategory: "settings", title: "User Credentials" },
  { url: `${BASE}/self-hosted/settings/user-settings/user-access-keys`, category: "platform", subcategory: "settings", title: "User Access Keys" },
  { url: `${BASE}/self-hosted/settings/user-settings/notifications`, category: "platform", subcategory: "settings", title: "User Notifications" },
];

// ---------------------------------------------------------------------------
// Management REST APIs
// ---------------------------------------------------------------------------
export const MANAGEMENT_APIS: DocPage[] = [
  // API Getting started
  { url: `${BASE}/api/2.24/getting-started/about-the-rest-api`, category: "api", subcategory: "getting-started", title: "About the REST API" },
  { url: `${BASE}/api/2.24/getting-started/how-to-authenticate-to-the-api`, category: "api", subcategory: "getting-started", title: "API Authentication" },
  { url: `${BASE}/api/2.24/getting-started/using-the-rest-api/making-rest-api-requests`, category: "api", subcategory: "getting-started", title: "Making REST API Requests" },
  { url: `${BASE}/api/2.24/getting-started/using-the-rest-api/pagination`, category: "api", subcategory: "getting-started", title: "Pagination" },
  { url: `${BASE}/api/2.24/getting-started/using-the-rest-api/http-status-codes`, category: "api", subcategory: "getting-started", title: "HTTP Status Codes" },

  // Organization management APIs
  { url: `${BASE}/api/2.24/organizations/clusters`, category: "api", subcategory: "organizations", title: "Clusters API" },
  { url: `${BASE}/api/2.24/organizations/departments`, category: "api", subcategory: "organizations", title: "Departments API" },
  { url: `${BASE}/api/2.24/organizations/projects`, category: "api", subcategory: "organizations", title: "Projects API" },
  { url: `${BASE}/api/2.24/organizations/nodepools`, category: "api", subcategory: "organizations", title: "Node Pools API" },
  { url: `${BASE}/api/2.24/organizations/nodes`, category: "api", subcategory: "organizations", title: "Nodes API" },
  { url: `${BASE}/api/2.24/organizations/tenant`, category: "api", subcategory: "organizations", title: "Tenant API" },

  // Auth & access APIs
  { url: `${BASE}/api/2.24/authentication-and-authorization/access-rules`, category: "api", subcategory: "auth", title: "Access Rules API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/access-keys`, category: "api", subcategory: "auth", title: "Access Keys API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/roles`, category: "api", subcategory: "auth", title: "Roles API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/users`, category: "api", subcategory: "auth", title: "Users API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/service-accounts`, category: "api", subcategory: "auth", title: "Service Accounts API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/applications`, category: "api", subcategory: "auth", title: "Applications API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/permissions`, category: "api", subcategory: "auth", title: "Permissions API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/tokens`, category: "api", subcategory: "auth", title: "Tokens API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/idps`, category: "api", subcategory: "auth", title: "Identity Providers API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/org-unit`, category: "api", subcategory: "auth", title: "Org Unit API" },

  // Additional management/control plane APIs
  { url: `${BASE}/api/2.24/authentication-and-authorization/settings`, category: "api", subcategory: "auth", title: "Settings API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/user-applications`, category: "api", subcategory: "auth", title: "User Applications API" },
  { url: `${BASE}/api/2.24/authentication-and-authorization/me`, category: "api", subcategory: "auth", title: "Me API" },
  { url: `${BASE}/api/2.24/getting-started/nvidia-run-ai-api-policy`, category: "api", subcategory: "getting-started", title: "API Policy" },
  { url: `${BASE}/api/2.24/organizations/network-topologies`, category: "api", subcategory: "organizations", title: "Network Topologies API" },
  { url: `${BASE}/api/2.24/organizations/reports`, category: "api", subcategory: "organizations", title: "Reports API" },
  { url: `${BASE}/api/2.24/organizations/logo`, category: "api", subcategory: "organizations", title: "Logo API" },
  { url: `${BASE}/api/2.24/audit/auditlogs`, category: "api", subcategory: "audit", title: "Audit Logs API" },

  // Workload and CRD-related APIs
  { url: `${BASE}/api/2.24/workloads/workload-properties`, category: "api", subcategory: "workloads", title: "Workload Properties API" },
  { url: `${BASE}/api/2.24/workloads/workloads`, category: "api", subcategory: "workloads", title: "Workloads API" },
  { url: `${BASE}/api/2.24/workloads/workloads-v2`, category: "api", subcategory: "workloads", title: "Workloads V2 API" },
  { url: `${BASE}/api/2.24/workloads/workspaces`, category: "api", subcategory: "workloads", title: "Workspaces API" },
  { url: `${BASE}/api/2.24/workloads/trainings`, category: "api", subcategory: "workloads", title: "Trainings API" },
  { url: `${BASE}/api/2.24/workloads/inferences`, category: "api", subcategory: "workloads", title: "Inferences API" },
  { url: `${BASE}/api/2.24/workloads/distributed`, category: "api", subcategory: "workloads", title: "Distributed Workloads API" },
  { url: `${BASE}/api/2.24/workloads/distributed-inferences`, category: "api", subcategory: "workloads", title: "Distributed Inferences API" },
  { url: `${BASE}/api/2.24/workloads/pods`, category: "api", subcategory: "workloads", title: "Pods API" },
  { url: `${BASE}/api/2.24/workloads/nvidia-nim`, category: "api", subcategory: "workloads", title: "NVIDIA NIM API" },
  { url: `${BASE}/api/2.24/workloads/workload-templates`, category: "api", subcategory: "workloads", title: "Workload Templates API" },
  { url: `${BASE}/api/2.24/workload-assets/compute`, category: "api", subcategory: "workload-assets", title: "Compute Assets API" },
  { url: `${BASE}/api/2.24/workload-assets/credentials`, category: "api", subcategory: "workload-assets", title: "Credentials Assets API" },
  { url: `${BASE}/api/2.24/workload-assets/datasources`, category: "api", subcategory: "workload-assets", title: "Datasources Assets API" },
  { url: `${BASE}/api/2.24/workload-assets/environment`, category: "api", subcategory: "workload-assets", title: "Environment Assets API" },
  { url: `${BASE}/api/2.24/workload-assets/storage-class-configuration`, category: "api", subcategory: "workload-assets", title: "Storage Class Configuration API" },
  { url: `${BASE}/api/2.24/datavolumes/datavolumes`, category: "api", subcategory: "workload-assets", title: "Data Volumes API" },
  { url: `${BASE}/api/2.24/policies/policy`, category: "api", subcategory: "policies", title: "Policies API" },
  { url: `${BASE}/api/2.24/notifications/notificationchannels`, category: "api", subcategory: "notifications", title: "Notification Channels API" },
  { url: `${BASE}/api/2.24/api-guides/nim-observability-metrics-via-api`, category: "api", subcategory: "guides", title: "NIM Observability Metrics API Guide" },
];

// ---------------------------------------------------------------------------
// Workloads — concepts, submission, assets, management
// ---------------------------------------------------------------------------
export const WORKLOADS_DOCS: DocPage[] = [
  // Concepts
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/introduction-to-workloads`, category: "workloads", subcategory: "concepts", title: "Introduction to Workloads" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workloads`, category: "workloads", subcategory: "concepts", title: "Workloads Overview" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-types`, category: "workloads", subcategory: "concepts", title: "Workload Types" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-types/native-workloads`, category: "workloads", subcategory: "concepts", title: "Native Workloads" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-types/supported-workload-types`, category: "workloads", subcategory: "concepts", title: "Supported Workload Types" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-types/supported-features`, category: "workloads", subcategory: "concepts", title: "Supported Features" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-types/extending-workload-support`, category: "workloads", subcategory: "concepts", title: "Extending Workload Support" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-types/extending-workload-support/defining-a-resource-interface`, category: "workloads", subcategory: "concepts", title: "Defining a Resource Interface" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-types/extending-workload-support/quick-start-templates`, category: "workloads", subcategory: "concepts", title: "Quick-Start Templates" },

  // Submission
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/submit-via-yaml`, category: "workloads", subcategory: "submission", title: "Submit via YAML" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-templates`, category: "workloads", subcategory: "templates", title: "Workload Templates" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-templates/workspace-templates`, category: "workloads", subcategory: "templates", title: "Workspace Templates" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-templates/training-templates/standard-training-templates`, category: "workloads", subcategory: "templates", title: "Standard Training Templates" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-templates/training-templates/distributed-training-templates`, category: "workloads", subcategory: "templates", title: "Distributed Training Templates" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-templates/inference-templates/custom-inference-templates`, category: "workloads", subcategory: "templates", title: "Custom Inference Templates" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-templates/inference-templates/nvidia-nim-inference-templates`, category: "workloads", subcategory: "templates", title: "NVIDIA NIM Inference Templates" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/workload-templates/inference-templates/hugging-face-inference-templates`, category: "workloads", subcategory: "templates", title: "Hugging Face Inference Templates" },

  // Workspaces
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-workspaces`, category: "workloads", subcategory: "workspaces", title: "Using Workspaces" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-workspaces/running-workspace`, category: "workloads", subcategory: "workspaces", title: "Running a Workspace" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-workspaces/quick-starts`, category: "workloads", subcategory: "workspaces", title: "Workspace Quick Starts" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-workspaces/quick-starts/jupyter-quickstart`, category: "workloads", subcategory: "workspaces", title: "Jupyter Quickstart" },

  // Training
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-training`, category: "workloads", subcategory: "training", title: "Using Training" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-training/train-models`, category: "workloads", subcategory: "training", title: "Train Models" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-training/distributed-training-models`, category: "workloads", subcategory: "training", title: "Distributed Training" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-training/checkpointing-preemptible-workloads`, category: "workloads", subcategory: "training", title: "Checkpointing Preemptible Workloads" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-training/quick-starts`, category: "workloads", subcategory: "training", title: "Training Quick Starts" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-training/quick-starts/standard-training-quickstart`, category: "workloads", subcategory: "training", title: "Standard Training Quickstart" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-training/quick-starts/distributed-training-quickstart`, category: "workloads", subcategory: "training", title: "Distributed Training Quickstart" },

  // Inference
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference`, category: "workloads", subcategory: "inference", title: "Using Inference" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference/nvidia-run-ai-inference-overview`, category: "workloads", subcategory: "inference", title: "Inference Overview" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference/custom-inference`, category: "workloads", subcategory: "inference", title: "Custom Inference" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference/nim-inference`, category: "workloads", subcategory: "inference", title: "NIM Inference" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference/hugging-face-inference`, category: "workloads", subcategory: "inference", title: "Hugging Face Inference" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference/nvcf`, category: "workloads", subcategory: "inference", title: "NVCF Integration" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference/quick-starts`, category: "workloads", subcategory: "inference", title: "Inference Quick Starts" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/using-inference/quick-starts/inference-quickstart`, category: "workloads", subcategory: "inference", title: "Inference Quickstart" },

  // Assets (environments, compute, datasources, credentials)
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/assets/overview`, category: "workloads", subcategory: "assets", title: "Assets Overview" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/assets/environments`, category: "workloads", subcategory: "assets", title: "Environments" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/assets/compute-resources`, category: "workloads", subcategory: "assets", title: "Compute Resources" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/assets/datasources`, category: "workloads", subcategory: "assets", title: "Data Sources" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/assets/credentials`, category: "workloads", subcategory: "assets", title: "Credentials" },
  { url: `${BASE}/self-hosted/workloads-in-nvidia-run-ai/assets/data-volumes`, category: "workloads", subcategory: "assets", title: "Data Volumes" },

  // AI Applications
  { url: `${BASE}/self-hosted/ai-applications/ai-applications`, category: "workloads", subcategory: "applications", title: "AI Applications" },
];

// ---------------------------------------------------------------------------
// Scheduler — concepts and resource optimization
// ---------------------------------------------------------------------------
export const SCHEDULER_DOCS: DocPage[] = [
  // Scheduling concepts
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/scheduling/how-the-scheduler-works`, category: "scheduler", subcategory: "concepts", title: "How the Scheduler Works" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/scheduling/concepts-and-principles`, category: "scheduler", subcategory: "concepts", title: "Concepts and Principles" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/scheduling/workload-priority-control`, category: "scheduler", subcategory: "concepts", title: "Workload Priority Control" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/scheduling/default-scheduler`, category: "scheduler", subcategory: "concepts", title: "Default Scheduler" },

  // Resource optimization
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/resource-optimization/fractions`, category: "scheduler", subcategory: "resource-optimization", title: "GPU Fractions" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/resource-optimization/dynamic-fractions`, category: "scheduler", subcategory: "resource-optimization", title: "Dynamic GPU Fractions" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/resource-optimization/time-slicing`, category: "scheduler", subcategory: "resource-optimization", title: "GPU Time Slicing" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/resource-optimization/node-level-scheduler`, category: "scheduler", subcategory: "resource-optimization", title: "Node-Level Scheduler" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/resource-optimization/memory-swap`, category: "scheduler", subcategory: "resource-optimization", title: "GPU Memory Swap" },
  { url: `${BASE}/self-hosted/platform-management/runai-scheduler/resource-optimization/quick-starts/dynamic-gpu-fractions-quickstart`, category: "scheduler", subcategory: "resource-optimization", title: "Dynamic GPU Fractions Quickstart" },
];

// ---------------------------------------------------------------------------
// CLI Reference
// ---------------------------------------------------------------------------
export const CLI_REFERENCE: DocPage[] = [
  // Overview & install
  { url: `${BASE}/self-hosted/reference/cli/install-cli`, category: "cli", subcategory: "overview", title: "Install CLI" },
  { url: `${BASE}/self-hosted/reference/cli/administrator-cli`, category: "cli", subcategory: "overview", title: "Administrator CLI" },
  { url: `${BASE}/self-hosted/reference/cli/runai`, category: "cli", subcategory: "overview", title: "runai CLI Overview" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_auth`, category: "cli", subcategory: "auth-commands", title: "runai auth" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_login`, category: "cli", subcategory: "auth-commands", title: "runai login" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_logout`, category: "cli", subcategory: "auth-commands", title: "runai logout" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_config`, category: "cli", subcategory: "auth-commands", title: "runai config" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_whoami`, category: "cli", subcategory: "auth-commands", title: "runai whoami" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_kubeconfig`, category: "cli", subcategory: "auth-commands", title: "runai kubeconfig" },

  // Workload commands
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_training`, category: "cli", subcategory: "workload-commands", title: "runai training" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_inference`, category: "cli", subcategory: "workload-commands", title: "runai inference" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_inference_describe`, category: "cli", subcategory: "workload-commands", title: "runai inference describe" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_workload`, category: "cli", subcategory: "workload-commands", title: "runai workload" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_workspace`, category: "cli", subcategory: "workload-commands", title: "runai workspace" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_pytorch`, category: "cli", subcategory: "workload-commands", title: "runai pytorch" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_mpi`, category: "cli", subcategory: "workload-commands", title: "runai mpi" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_tensorflow`, category: "cli", subcategory: "workload-commands", title: "runai tensorflow" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_jax`, category: "cli", subcategory: "workload-commands", title: "runai jax" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_xgboost`, category: "cli", subcategory: "workload-commands", title: "runai xgboost" },

  // Resource commands
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_cluster`, category: "cli", subcategory: "resource-commands", title: "runai cluster" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_node`, category: "cli", subcategory: "resource-commands", title: "runai node" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_nodepool`, category: "cli", subcategory: "resource-commands", title: "runai nodepool" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_project`, category: "cli", subcategory: "resource-commands", title: "runai project" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai-compute`, category: "cli", subcategory: "resource-commands", title: "runai compute" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai-datasource`, category: "cli", subcategory: "resource-commands", title: "runai datasource" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai-department`, category: "cli", subcategory: "resource-commands", title: "runai department" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai-environment`, category: "cli", subcategory: "resource-commands", title: "runai environment" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai-template`, category: "cli", subcategory: "resource-commands", title: "runai template" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_pvc`, category: "cli", subcategory: "resource-commands", title: "runai pvc" },

  // Utility commands
  { url: `${BASE}/self-hosted/reference/cli/runai/runai-diagnostics`, category: "cli", subcategory: "utility-commands", title: "runai diagnostics" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_version`, category: "cli", subcategory: "utility-commands", title: "runai version" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_upgrade`, category: "cli", subcategory: "utility-commands", title: "runai upgrade" },
  { url: `${BASE}/self-hosted/reference/cli/runai/runai_report`, category: "cli", subcategory: "utility-commands", title: "runai report" },
];

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
export const POLICIES_DOCS: DocPage[] = [
  { url: `${BASE}/self-hosted/platform-management/policies/policies-and-rules`, category: "policies", subcategory: "overview", title: "Policies and Rules" },
  { url: `${BASE}/self-hosted/platform-management/policies/workload-policies`, category: "policies", subcategory: "overview", title: "Workload Policies" },
  { url: `${BASE}/self-hosted/platform-management/policies/scheduling-rules`, category: "policies", subcategory: "overview", title: "Scheduling Rules" },
  { url: `${BASE}/self-hosted/platform-management/policies/policy-yaml-reference`, category: "policies", subcategory: "reference", title: "Policy YAML Reference" },
  { url: `${BASE}/self-hosted/platform-management/policies/policy-yaml-examples`, category: "policies", subcategory: "reference", title: "Policy YAML Examples" },
];

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------
export const ALL_PAGES: DocPage[] = [
  ...SELF_HOSTED_INSTALL,
  ...SELF_HOSTED_INFRA,
  ...PLATFORM_MANAGEMENT,
  ...MANAGEMENT_APIS,
  ...WORKLOADS_DOCS,
  ...SCHEDULER_DOCS,
  ...CLI_REFERENCE,
  ...POLICIES_DOCS,
];

// ---------------------------------------------------------------------------
// SaaS (unversioned)
// ---------------------------------------------------------------------------
export const SAAS_PAGES: DocPage[] = [
  { url: `${BASE}/saas/getting-started/overview`, category: "getting-started", subcategory: "overview", title: "Overview" },
  { url: `${BASE}/saas/getting-started/whats-new-for-nvidia-run-ai-saas`, category: "getting-started", subcategory: "whats-new", title: "What's New for SaaS" },
  { url: `${BASE}/saas/getting-started/installation`, category: "getting-started", subcategory: "installation", title: "Installation" },
  { url: `${BASE}/saas/support-policy/product-support-policy`, category: "support-policy", subcategory: "overview", title: "Product Support Policy" },
  { url: `${BASE}/saas/support-policy/product-version-life-cycle`, category: "support-policy", subcategory: "versions", title: "Product Version Life Cycle" },
];

// ---------------------------------------------------------------------------
// Multi-tenant (versioned)
// ---------------------------------------------------------------------------
export const MULTI_TENANT_PAGES: DocPage[] = [
  { url: `${BASE}/multi-tenant/${VERSION_TOKEN}/getting-started/overview`, category: "getting-started", subcategory: "overview", title: "Overview" },
  { url: `${BASE}/multi-tenant/${VERSION_TOKEN}/getting-started/installation`, category: "getting-started", subcategory: "installation", title: "Installation" },
  { url: `${BASE}/multi-tenant/${VERSION_TOKEN}/getting-started/api-access-setup`, category: "getting-started", subcategory: "api-access", title: "API Access Setup" },
  { url: `${BASE}/multi-tenant/${VERSION_TOKEN}/support-policy/product-support-policy`, category: "support-policy", subcategory: "overview", title: "Product Support Policy" },
  { url: `${BASE}/multi-tenant/${VERSION_TOKEN}/support-policy/product-version-life-cycle`, category: "support-policy", subcategory: "versions", title: "Product Version Life Cycle" },
];

// ---------------------------------------------------------------------------
// Legacy docs (docs.run.ai) - versioned with v{VERSION}
// ---------------------------------------------------------------------------
export const LEGACY_PAGES: DocPage[] = [
  { url: `https://docs.run.ai/v${VERSION_TOKEN}/home/documentation-library`, category: "home", subcategory: "overview", title: "Documentation Library" },
  { url: `https://docs.run.ai/v${VERSION_TOKEN}/developer/admin-rest-api/overview/`, category: "developer", subcategory: "api", title: "Run:ai REST API Overview" },
  { url: `https://docs.run.ai/v${VERSION_TOKEN}/developer/cluster-api/workload-overview-dev/`, category: "developer", subcategory: "cluster-api", title: "Cluster API (Deprecated)" },
  { url: `https://docs.run.ai/v${VERSION_TOKEN}/Researcher/cli-reference/new-cli/overview/`, category: "researcher", subcategory: "cli", title: "CLI v2 Overview" },
];
