# NVIDIA Run:ai v2.24 Management REST API -- Complete Specification

> Extracted 2026-02-05 from https://run-ai-docs.nvidia.com/api/2.24/
> Scope: organizational / management endpoints only (no workload submission).

---

## Table of Contents

1. [Authentication & Setup](#1-authentication--setup)
2. [Clusters API](#2-clusters-api)
3. [Departments API](#3-departments-api)
4. [Projects API](#4-projects-api)
5. [Node Pools API](#5-node-pools-api)
6. [Nodes API](#6-nodes-api)
7. [Tenant Settings API](#7-tenant-settings-api)
8. [Access Rules API](#8-access-rules-api)
9. [Access Keys API](#9-access-keys-api)
10. [Roles API](#10-roles-api)
11. [Users API](#11-users-api)
12. [Service Accounts API](#12-service-accounts-api)
13. [Applications API (deprecated)](#13-applications-api-deprecated)
14. [Permissions API](#14-permissions-api)
15. [Tokens API](#15-tokens-api)
16. [Identity Providers (IDPs) API](#16-identity-providers-idps-api)
17. [Org-Unit Utility API](#17-org-unit-utility-api)

---

## 1. Authentication & Setup

### 1.1 Base URL

| Deployment | Base URL |
|---|---|
| SaaS | `https://<tenant-name>.run.ai` |
| Self-hosted | `https://<your-custom-ui-url>` |

All paths below are relative to this base URL.

### 1.2 API Versioning

- **Latest** -- updated biweekly, recommended for SaaS.
- **Versioned** -- aligned to product releases (2.22, 2.23, **2.24**); behaviour fixed for the release lifecycle.
- **Deprecation policy**: 6 months for SaaS; 2 additional released versions for self-hosted.

### 1.3 Authentication Flow

1. Obtain an access key (client ID + client secret) via service accounts or personal access keys.
2. POST credentials to the token endpoint to receive a bearer token.
3. Include the token in every request: `Authorization: Bearer <TOKEN>`

**Token request (simplified v1):**

```
POST /api/v1/token
Content-Type: application/json

{
  "clientId": "<CLIENT_ID>",
  "clientSecret": "<CLIENT_SECRET>",
  "grantType": "client_credentials"
}
```

**Response:**
```json
{
  "accessToken": "<TOKEN>",
  "expiresIn": 86400
}
```

### 1.4 Required Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <access-token>` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

### 1.5 HTTP Methods

| Method | Semantics |
|---|---|
| GET | Retrieve resource(s) |
| POST | Create resource |
| PUT | Replace resource |
| PATCH | Partial update |
| DELETE | Delete resource |

### 1.6 Status Codes

| Range | Meaning |
|---|---|
| 2xx | Success |
| 400 | Bad Request |
| 401 | Unauthorized (missing/expired token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (resource already exists) |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### 1.7 Pagination (common query parameters)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `offset` | integer | 0 | First item offset |
| `limit` | integer | 50 | Max entries (min 1, max 500) |
| `sortBy` | string | varies | Field to sort by |
| `sortOrder` | string | `asc` | `asc` or `desc` |
| `filterBy` | array[string] | -- | Format: `field operator value`. Operators: `==`, `!=`, `<=`, `>=`, `=@` (contains), `!@` (not contains), `=^` (starts with), `=$` (ends with) |
| `search` | string | -- | Free-text search |

Paginated list responses include `"next": <integer>` indicating the offset of the next page (absent when no more pages).

### 1.8 Timestamps

All timestamps are UTC in ISO 8601 format: `2024-01-01T00:00:00Z`.

### 1.9 Common Error Response Schema

```json
{
  "code": 400,
  "message": "string",
  "details": "string"
}
```

---

## 2. Clusters API

### 2.1 GET /api/v1/clusters

List clusters.

**Query Parameters:**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `verbosity` | string enum | No | `full` | `metadata` or `full` |
| `includeRequestedForDelete` | boolean | No | false | Include clusters marked for deletion |

**Response 200:** `{ clusters: DisplayedCluster[] }` (inferred array)

**DisplayedCluster schema:**

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `uuid` | string (UUID) | Yes | No | Cluster UUID |
| `tenantId` | integer | Yes | No | Tenant identifier |
| `name` | string | Yes | No | Cluster name |
| `createdAt` | string (date-time) | Yes | No | Creation timestamp |
| `domain` | string | No | Yes | Cluster domain |
| `version` | string | No | Yes | Cluster version |
| `status` | ClusterDisplayedStatus | No | Yes | Cluster status |
| `updatedAt` | string (date-time) | No | Yes | Last update |
| `deletedAt` | string (date-time) | No | Yes | Deletion timestamp |
| `lastLiveness` | string (date-time) | No | Yes | Last liveness check |
| `deleteRequestedAt` | string (date-time) | No | Yes | Deletion request timestamp |

**Error responses:** 401, 403, 404, 500, 503

---

### 2.2 POST /api/v1/clusters

Create cluster.

**Request body (ClusterCreationRequest):**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Cluster name |
| `domain` | string | No | Cluster domain |
| `version` | string | No | Cluster version |

**Response 201:** DisplayedCluster object.

**Error responses:** 401, 403, 404, 500, 503

---

### 2.3 GET /api/v1/clusters/{clusterUuid}

Get cluster by UUID.

**Path parameters:**

| Name | Type | Required |
|---|---|---|
| `clusterUuid` | string (UUID) | Yes |

**Query parameters:** `verbosity` (same as list)

**Response 200:** DisplayedCluster

**Error responses:** 401, 403, 404, 500, 503

---

### 2.4 PUT /api/v1/clusters/{clusterUuid}

Update cluster.

**Path parameters:** `clusterUuid` (UUID, required)

**Request body (ClusterUpdateRequest):**

| Field | Type | Required |
|---|---|---|
| `name` | string | Yes |

**Response:** 204 No Content

**Error responses:** 400, 401, 403, 500, 503

---

### 2.5 DELETE /api/v1/clusters/{clusterUuid}

Delete cluster. Returns 202 for graceful deletion (cluster >= v2.20, force=false); 204 for forced/legacy.

**Path parameters:** `clusterUuid` (UUID, required)

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `force` | boolean | No | false |

**Response 202:**
```json
{ "code": 202, "message": "string" }
```
**Response 204:** No content.

**Error responses:** 401, 403, 500, 503

---

### 2.6 GET /api/v1/clusters/{clusterUuid}/metrics

Get cluster metrics.

**Path parameters:** `clusterUuid` (UUID, required)

**Query parameters:**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `start` | string (date-time) | Yes | -- | ISO 8601 start |
| `end` | string (date-time) | Yes | -- | ISO 8601 end |
| `numberOfSamples` | integer | No | 20 | 0--1000 |
| `metricType` | array[string] | Yes | -- | See enum below |
| `groupBy` | string | No | -- | `Category`, `Nodepool`, `Project`, `Department` |
| `nodepoolName` | string | No | -- | Filter by nodepool |

**metricType enum:** `TOTAL_GPU_NODES`, `GPU_UTILIZATION`, `GPU_UTILIZATION_DISTRIBUTION`, `GPU_MEMORY_UTILIZATION`, `CPU_UTILIZATION`, `CPU_MEMORY_UTILIZATION`, `TOTAL_GPU`, `GPU_QUOTA`, `ALLOCATED_GPU`, `UNALLOCATED_GPU`, `AVG_WORKLOAD_WAIT_TIME`, `WORKLOADS_COUNT`

**Response 200 (GroupedMetricsResponse):**
```json
{
  "measurements": [
    {
      "type": "string",
      "labels": { "key": "value" },
      "values": [
        { "value": "string", "timestamp": "2024-01-01T00:00:00Z" }
      ],
      "groups": [
        { "key": "string", "value": "string" }
      ]
    }
  ]
}
```

**Response 207:** Partial success (same schema).

**Error responses:** 400, 401, 403, 404, 422, 500, 503

---

### 2.7 GET /api/v1/clusters/{clusterUuid}/cluster-install-info

Get installation instructions (clusters >= v2.15).

**Path parameters:** `clusterUuid` (UUID, required)

**Query parameters:**

| Name | Type | Required |
|---|---|---|
| `version` | string | Yes |
| `remoteClusterUrl` | string | No |

**Response 200 (ClusterInstallationInfoResponse):**
```json
{
  "installationStr": "string",
  "repositoryName": "string",
  "chartRepoURL": "string",
  "clientSecret": "string"
}
```

**Error responses:** 401, 403, 404, 500, 503

---

### 2.8 GET /v1/k8s/clusters/{cluster_uuid}/installfile (Legacy, clusters <= v2.13)

**Path parameters:** `cluster_uuid` (UUID, required)

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `cloud` | string enum | No | -- |
| `clusterip` | string | No | -- |
| `format` | string enum | No | `yaml` |

**cloud enum:** `gke`, `aws`, `aks`, `op`, `airgapped`, `openshift`
**format enum:** `json`, `yaml`

**Response 200:** Plain text string.

**Error responses:** 401, 404

---

### 2.9 GET /v1/k8s/clusters/{clusterUuid}/metrics (DEPRECATED)

Deprecated -- use `/api/v1/clusters/{clusterUuid}/metrics`.

**Path parameters:** `clusterUuid` (UUID, required)

**Query parameters:** `start`, `end` (date-time, optional), `numberOfSamples` (int, optional, default 20), `nodepoolName` (string, optional)

**Response 200:** Complex cluster metrics object with `metadata`, `current` (resources, projectResources), `timeRange`.

**Error responses:** 401, 403, 404, 500, 503

---

## 3. Departments API

### 3.1 GET /api/v1/org-unit/departments

List departments.

**Query parameters:**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `filterBy` | array[string] | No | -- | Filterable: name, clusterId, totalGpuQuota, gpuAllocated, createdAt, avgGpuAllocation24h/7d/30d, avgGpuUtilization24h/7d/30d, avgGpuMemoryUtilization24h/7d/30d |
| `sortBy` | string | No | -- | Sort field |
| `sortOrder` | string | No | `asc` | `asc` or `desc` |
| `offset` | integer | No | 0 | Pagination offset |
| `limit` | integer | No | 50 | 1--500 |
| `verbosity` | string | No | -- | `meta`, `brief`, or `verbose` |

**Response 200:**
```json
{
  "departments": [ <Department> ],
  "next": 50
}
```

**Department schema:**

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string | Yes | No | Department ID |
| `name` | string | Yes | No | Department name |
| `clusterId` | string (UUID) | Yes | No | Associated cluster |
| `description` | string | No | No | Description |
| `createdAt` | string (date-time) | Yes | No | Created timestamp |
| `updatedAt` | string (date-time) | Yes | No | Updated timestamp |
| `createdBy` | string | Yes | No | Creator |
| `updatedBy` | string | Yes | No | Last updater |
| `children` | array[{ id, name, children }] | No | No | Child org units |
| `status.quotaStatus` | object | No | No | `allocated`, `allocatedNonPreemptible`, `requested` (each: gpu, cpu, memory) |
| `totalResources` | object | No | No | `gpuQuota`, `cpuQuota`, `memoryQuota` |
| `resources` | array[ResourceConfig] | No | No | Per-nodepool resources |
| `overtimeData` | object | No | No | range24hData, range7dData, range30dData (each: averageGpuAllocation, averageGpuUtilization, averageGpuMemoryUtilization, updatedAt) |

**ResourceConfig schema:**

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `nodePool.id` | string | Yes | No | Node pool ID |
| `nodePool.name` | string | No | No | Node pool name |
| `gpu.deserved` | number | No | No | GPU deserved quota (default 0) |
| `gpu.limit` | number | No | Yes | GPU limit |
| `gpu.overQuotaWeight` | number | No | Yes | 1--20 |
| `cpu.deserved` | number | No | Yes | CPU deserved (millicores) |
| `cpu.limit` | number | No | Yes | CPU limit |
| `cpu.overQuotaWeight` | number | No | Yes | Over-quota weight |
| `memory.deserved` | number | No | Yes | Memory deserved |
| `memory.limit` | number | No | Yes | Memory limit |
| `memory.overQuotaWeight` | number | No | Yes | Over-quota weight |
| `memory.units` | string enum | Yes (if memory) | No | `Mib`, `MB`, `GB` |
| `rank` | string | No | No | Default: `MediumLow` |
| `priority` | string | No | No | DEPRECATED |

**Error responses:** 400, 401, 403, 503

---

### 3.2 POST /api/v1/org-unit/departments

Create department.

**Request body:**
```json
{
  "name": "string (required, lowercase alphanumeric/hyphens)",
  "clusterId": "uuid (required)",
  "description": "string",
  "resources": [ <ResourceConfig> ],
  "schedulingRules": {
    "interactiveJobTimeLimitSeconds": "integer|null (min 1)",
    "interactiveJobMaxIdleDurationSeconds": "integer|null (min 1)",
    "interactiveJobPreemptIdleDurationSeconds": "integer|null (min 1)",
    "trainingJobMaxIdleDurationSeconds": "integer|null (min 1)",
    "trainingJobTimeLimitSeconds": "integer|null (min 1)"
  },
  "defaultNodePools": ["string"],
  "nodeTypes": {
    "training": ["string"],
    "workspace": ["string"],
    "names": { "<id>": "<name>" }
  }
}
```

**Response 201:** Full Department object.

**Error responses:** 400, 401, 403, 409, 503

---

### 3.3 GET /api/v1/org-unit/departments/{departmentId}

**Path parameters:** `departmentId` (string, required)

**Response 200:** Department object.

**Error responses:** 401, 403, 404, 503

---

### 3.4 PUT /api/v1/org-unit/departments/{departmentId}

Update department.

**Path parameters:** `departmentId` (string, required)

**Request body:** `description`, `schedulingRules`, `defaultNodePools`, `nodeTypes`, `resources` (all optional).

**Response 200:** Updated Department object.

**Error responses:** 400, 401, 403, 404, 503

---

### 3.5 DELETE /api/v1/org-unit/departments/{departmentId}

**Path parameters:** `departmentId` (string, required)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 503

---

### 3.6 PUT /api/v1/org-unit/departments/{departmentId}/resources

Replace department resources.

**Path parameters:** `departmentId` (string, required)

**Request body:** Array of ResourceConfig objects.

**Response 200:** Array of ResourceConfig objects.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 3.7 PATCH /api/v1/org-unit/departments/{departmentId}/resources

Partial update to specific resource items.

**Path parameters:** `departmentId` (string, required)

**Request body:** Array of partial ResourceConfig objects.

**Response 200:** Array of updated ResourceConfig objects.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 3.8 GET /api/v1/org-unit/departments/{departmentId}/metrics

Department metrics.

**Path parameters:** `departmentId` (string, required)

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `metricType` | array[string] | Yes | -- |
| `start` | string (date-time) | Yes | -- |
| `end` | string (date-time) | Yes | -- |
| `numberOfSamples` | integer | No | 20 |
| `nodepoolName` | string | No | -- |

**metricType enum:** `GPU_QUOTA`, `CPU_QUOTA_MILLICORES`, `CPU_MEMORY_QUOTA_MB`, `GPU_ALLOCATION`, `CPU_ALLOCATION_MILLICORES`, `CPU_MEMORY_ALLOCATION_MB`, `GPU_MEMORY_UTILIZATION`

**Response 200:**
```json
{
  "measurements": [
    {
      "type": "string",
      "labels": { "key": "value" },
      "values": [
        { "value": "string", "timestamp": "date-time" }
      ]
    }
  ]
}
```

**Response 207:** Partial success.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 3.9 GET /api/v1/org-unit/departments/telemetry

**Query parameters:**

| Name | Type | Required |
|---|---|---|
| `telemetryType` | string enum | Yes |
| `clusterId` | string (UUID) | No |
| `nodepoolName` | string | No |
| `departmentId` | string | No |
| `groupBy` | array[string] (max 2) | No |

**telemetryType enum:** `GPU_QUOTA`, `CPU_QUOTA`, `MEMORY_QUOTA`, `GPU_ALLOCATION`, `CPU_ALLOCATION`, `MEMORY_ALLOCATION`, `GPU_ALLOCATION_NON_PREEMPTIBLE`, `CPU_ALLOCATION_NON_PREEMPTIBLE`, `MEMORY_ALLOCATION_NON_PREEMPTIBLE`

**groupBy enum:** `CLUSTER_ID`

**Response 200:**
```json
{
  "type": "string",
  "timestamp": "date-time",
  "values": [
    {
      "value": "string",
      "groups": [
        { "key": "string", "value": "string", "name": "string" }
      ]
    }
  ]
}
```

**Error responses:** 400, 401, 403, 503

---

### 3.10 GET /api/v1/org-unit/departments/count

**Query parameters:** `filterBy` (array[string], optional; same fields as list).

**Response 200:**
```json
{ "count": 42 }
```

**Error responses:** 400, 401, 403, 503

---

### 3.11 GET /api/v1/org-unit/departments/node-pool-resources

List departments' per-nodepool resource quotas.

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `filterBy` | array[string] | No | -- |
| `sortBy` | string | No | -- |
| `sortOrder` | string | No | `asc` |
| `offset` | integer | No | 0 |
| `limit` | integer | No | 50 |
| `search` | string | No | -- |

Filterable/sortable: `nodePoolName`, `nodePoolId`, `orgUnitId`, `orgUnitName`, `rank`, `clusterId`, `gpuDeserved`, `gpuOverQuotaWeight`

**Response 200:**
```json
{
  "nodePoolResources": [
    {
      "id": "string",
      "orgUnitId": "string",
      "orgUnitName": "string",
      "clusterId": "string",
      "nodePoolId": "string",
      "nodePoolName": "string",
      "rank": "string",
      "resources": {
        "gpu": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 },
        "cpu": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 },
        "memory": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 }
      }
    }
  ],
  "next": 50
}
```

**Error responses:** 400, 401, 403, 503

---

### 3.12 GET /api/v1/org-unit/departments/node-pool-resources/count

**Query parameters:** `filterBy` (array[string], optional), `search` (string, optional).

**Response 200:**
```json
{ "count": 42 }
```

**Error responses:** 400, 401, 403, 503

---

### 3.13 PATCH /api/v1/org-unit/departments/node-pool-resources/batch

Batch-update node pool quotas for multiple departments (1--100 items).

**Request body:**
```json
{
  "patchRequests": [
    {
      "orgUnitId": "string (required)",
      "nodePoolId": "string (required)",
      "rank": "string|null",
      "resources": {
        "gpu": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 },
        "cpu": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 },
        "memory": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 }
      }
    }
  ]
}
```
Constraints: `patchRequests` min 1, max 100 items.

**Response 200:**
```json
{
  "id": "uuid",
  "succeeded": [ <NodePoolResource> ],
  "failed": [
    {
      "request": {},
      "error": { "code": 400, "message": "string", "details": "string" }
    }
  ],
  "totalRequested": 5,
  "totalSuccessful": 4,
  "totalFailed": 1
}
```

**Error responses:** 400, 401, 403, 500, 503

---

## 4. Projects API

### 4.1 GET /api/v1/org-unit/projects

List projects.

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `filterBy` | array[string] | No | -- |
| `sortBy` | string | No | -- |
| `sortOrder` | string | No | `asc` |
| `offset` | integer | No | 0 |
| `limit` | integer | No | 50 (max 500) |
| `search` | string | No | -- |

Filterable fields: `name`, `clusterId`, `departmentId`, `parentId`, `parentName`, `phase`, `totalGpuQuota`, `gpuAllocated`, `createdAt`, plus avg metrics for 24h/7d/30d.

**Response 200:**
```json
{
  "projects": [ <Project> ],
  "next": 50
}
```

**Project schema:**

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | No | Project ID |
| `name` | string | No | Project name |
| `clusterId` | string (UUID) | No | Cluster UUID |
| `parentId` | string | Yes | Parent department ID |
| `requestedNamespace` | string | Yes | Custom K8s namespace |
| `enforceRunaiScheduler` | boolean | No | Enforce Run:ai scheduler |
| `description` | string | No | Description |
| `createdAt` | string (date-time) | No | Created |
| `updatedAt` | string (date-time) | No | Updated |
| `createdBy` | string | No | Creator |
| `updatedBy` | string | No | Updater |
| `status` | ProjectStatus | No | See below |
| `totalResources` | object | No | gpuQuota, cpuQuota, memoryQuota |
| `resources` | array[ResourceConfig] | No | Per-nodepool resources |
| `parent` | object | Yes | `{ id, name, parent }` (recursive) |
| `effective` | object | No | Effective schedulingRules, defaultNodePools, nodeTypes |
| `overtimeData` | object | No | 24h/7d/30d average metrics |
| `schedulingRules` | object | Yes | Scheduling rules |
| `defaultNodePools` | array[string] | Yes | Default node pools |
| `nodeTypes` | object | No | training, workspace, names |

**ProjectStatus schema:**

| Field | Type | Nullable |
|---|---|---|
| `namespace` | string | Yes |
| `phase` | string enum | No |
| `phaseMessage` | string | Yes |
| `lastUpdatedTime` | date-time | Yes |
| `nodePoolQuotaStatuses` | array | No |
| `quotaStatus` | object | No |
| `additionalStatusData` | object | Yes |

**phase enum:** `Creating`, `Updating`, `Deleting`, `Deleted`, `Initializing`, `Ready`, `NotReady`, `Unknown`

**Error responses:** 400, 401, 403, 503

---

### 4.2 POST /api/v1/org-unit/projects

Create project.

**Request body:**
```json
{
  "name": "string (required, lowercase alphanumeric/hyphens)",
  "clusterId": "uuid (required)",
  "requestedNamespace": "string|null",
  "enforceRunaiScheduler": "boolean|null (default true)",
  "parentId": "string|null",
  "resources": [
    {
      "nodePool": { "id": "string (required)", "name": "string" },
      "gpu": { "deserved": 0, "limit": null, "overQuotaWeight": null },
      "cpu": { "deserved": null, "limit": null, "overQuotaWeight": null },
      "memory": { "deserved": null, "limit": null, "overQuotaWeight": null, "units": "Mib|MB|GB" },
      "rank": "MediumLow"
    }
  ],
  "description": "string",
  "schedulingRules": {
    "interactiveJobTimeLimitSeconds": null,
    "interactiveJobMaxIdleDurationSeconds": null,
    "interactiveJobPreemptIdleDurationSeconds": null,
    "trainingJobMaxIdleDurationSeconds": null,
    "trainingJobTimeLimitSeconds": null
  },
  "defaultNodePools": ["string"],
  "nodeTypes": {
    "training": ["string"],
    "workspace": ["string"],
    "names": { "<id>": "<name>" }
  }
}
```

**Response 201:** Full Project object.

**Error responses:** 400, 401, 403, 409, 503

---

### 4.3 GET /api/v1/org-unit/projects/{projectId}

**Path parameters:** `projectId` (string, required)

**Response 200:** Project object.

**Error responses:** 401, 403, 404, 503

---

### 4.4 PUT /api/v1/org-unit/projects/{projectId}

Update project.

**Path parameters:** `projectId` (string, required)

**Request body:**
```json
{
  "enforceRunaiScheduler": "boolean|null",
  "resources": [ <ResourceConfig> ],
  "description": "string",
  "schedulingRules": {},
  "defaultNodePools": ["string"],
  "nodeTypes": {}
}
```
`resources` is required in the PUT body.

**Response 200:** Updated Project object.

**Error responses:** 400, 401, 403, 404, 503

---

### 4.5 DELETE /api/v1/org-unit/projects/{projectId}

**Path parameters:** `projectId` (string, required)

**Response 202:** Accepted (graceful deletion).
**Response 204:** Deleted.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 4.6 PUT /api/v1/org-unit/projects/{projectId}/resources

Replace project resources.

**Path parameters:** `projectId` (string, required)

**Request body:** Array of ResourceConfig objects.

**Response 200:** Array of ResourceConfig objects.

**Error responses:** 400, 401, 403, 404, 503

---

### 4.7 PATCH /api/v1/org-unit/projects/{projectId}/resources

Partial update.

**Path parameters:** `projectId` (string, required)

**Request/Response:** Same as PUT resources.

**Error responses:** 400, 401, 403, 404, 503

---

### 4.8 GET /api/v1/org-unit/projects/{projectId}/metrics

**Path parameters:** `projectId` (string, required)

**Query parameters:** Same as department metrics (metricType, start, end, numberOfSamples, nodepoolName).

**metricType enum:** `GPU_QUOTA`, `CPU_QUOTA_MILLICORES`, `CPU_MEMORY_QUOTA_MB`, `GPU_ALLOCATION`, `CPU_ALLOCATION_MILLICORES`, `CPU_MEMORY_ALLOCATION_MB`, `GPU_MEMORY_UTILIZATION`

**Response 200/207:** Measurements array (same format as department metrics).

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 4.9 GET /api/v1/org-unit/projects/telemetry

**Query parameters:**

| Name | Type | Required |
|---|---|---|
| `telemetryType` | string enum | Yes |
| `clusterId` | string (UUID) | No |
| `nodepoolId` | string | No |
| `departmentId` | string | No |
| `groupBy` | array[string] (max 2) | No |

**telemetryType enum:** Same as departments.

**groupBy enum:** `ClusterId`, `NodepoolId`, `ParentId`

**Response 200:** Telemetry values (same format as department telemetry).

**Error responses:** 400, 401, 403, 503

---

### 4.10 GET /api/v1/org-unit/projects/count

**Query parameters:** `filterBy` (array, optional), `search` (string, optional).

**Response 200:** `{ "count": 42 }`

**Error responses:** 400, 401, 403, 503

---

### 4.11 GET /api/v1/org-unit/projects/node-pool-resources

List projects' per-nodepool resources.

**Query parameters:** `filterBy`, `sortBy`, `sortOrder`, `offset`, `limit`, `search`.

Filterable: `nodePoolName`, `nodePoolId`, `parentId`, `orgUnitId`, `orgUnitName`, `rank`, `clusterId`.

**Response 200:**
```json
{
  "resources": [
    {
      "id": "string",
      "orgUnitId": "string",
      "orgUnitName": "string",
      "parentId": "string",
      "clusterId": "string",
      "nodePoolId": "string",
      "nodePoolName": "string",
      "rank": "string",
      "resources": {
        "gpu": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 },
        "cpu": { "deserved": 0, "limit": 0, "overQuotaWeight": 0 },
        "memory": { "deserved": 0, "limit": 0, "overQuotaWeight": 0, "units": "Mib" }
      },
      "quotaStatus": {
        "allocated": { "gpu": 0, "cpu": 0, "memory": 0 },
        "allocatedNonPreemptible": { "gpu": 0, "cpu": 0, "memory": 0 },
        "requested": { "gpu": 0, "cpu": 0, "memory": 0 }
      }
    }
  ]
}
```

**Error responses:** 400, 401, 403, 503

---

## 5. Node Pools API

### 5.1 GET /api/v1/node-pools

List node pools.

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `filterBy` | array[string] | No | -- |
| `sortBy` | string | No | -- |
| `sortOrder` | string | No | `asc` |
| `offset` | integer | No | 0 |
| `limit` | integer | No | 50 (max 500) |

Sortable: `name`, `phase`, `clusterId`, `createdAt`, `updatedAt`, `networkTopologyName`, `gpuNetworkAccelerationDetection`, `gpuNetworkAccelerationDetected`, `gpuNetworkAccelerationLabelKey`, `swapEnabled`, `nodeLevelSchedulerEnabled`

**Response 200:**
```json
{
  "nodepools": [ <Nodepool> ]
}
```

**Nodepool schema:**

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | No | Nodepool ID |
| `name` | string | No | Name |
| `labelKey` | string | No | K8s label key |
| `labelValue` | string | No | K8s label value |
| `clusterId` | string (UUID) | No | Cluster |
| `phase` | string enum | No | `Ready`, `Creating`, `Updating`, `Deleting`, `Empty`, `Unschedulable`, `Deleted` |
| `phaseMessage` | string | Yes | Phase details |
| `tenantId` | integer | No | Tenant |
| `clusterName` | string | No | Cluster name |
| `createdBy` | string | No | Creator |
| `createdAt` | date-time | No | Created |
| `updatedBy` | string | No | Updater |
| `updatedAt` | date-time | No | Updated |
| `isDefault` | boolean | No | Default nodepool flag |
| `gpuNetworkAccelerationDetection` | string enum | No | `Auto`, `Use`, `DontUse` |
| `gpuNetworkAccelerationLabelKey` | string | Yes | Label key for detection |
| `networkTopologyId` | string (UUID) | Yes | Network topology |
| `networkTopologyName` | string | Yes | Topology name |
| `gpuResourceOptimization` | object | No | See below |
| `schedulingConfiguration` | object | No | See below |
| `status` | object | No | See below |

**gpuResourceOptimization:**
```json
{
  "swapEnabled": true,
  "cpuSwapMemorySize": "100G",
  "reservedGpuMemoryForSwapOperations": "2G",
  "nodeLevelSchedulerEnabled": false
}
```

**schedulingConfiguration:**
```json
{
  "placementStrategy": { "cpu": "spread|binpack", "gpu": "spread|binpack" },
  "minGuaranteedRuntime": "5d8h40m",
  "timeBasedFairShare": {
    "enabled": true,
    "historicalUsageWeight": 1.0,
    "decayHalfLife": "0h|24h|7d",
    "windowType": "sliding|tumbling",
    "windowDuration": "7d",
    "tumblingWindowStartTime": "2024-01-01T00:00:00Z"
  }
}
```

**status:**
```json
{
  "labelKey": "string",
  "labelValue": "string",
  "gpuNetworkAccelerationDetected": true,
  "nodes": ["node1"],
  "conditions": [
    {
      "type": "string",
      "reason": "string",
      "message": "string",
      "status": "True|False",
      "nodes": ["node1"]
    }
  ]
}
```

**Error responses:** 400, 401, 403, 503

---

### 5.2 POST /api/v1/node-pools

Create node pool.

**Request body:**
```json
{
  "name": "string (required)",
  "labelKey": "string (required)",
  "labelValue": "string (required)",
  "clusterId": "uuid (required)",
  "overProvisioningRatio": 1,
  "gpuNetworkAccelerationLabelKey": "string",
  "gpuNetworkAccelerationDetection": "Auto|Use|DontUse",
  "networkTopologyId": "uuid",
  "gpuResourceOptimization": { ... },
  "schedulingConfiguration": { ... }
}
```

**Response 201:** Complete Nodepool object.

**Error responses:** 400, 401, 403, 503

---

### 5.3 GET /api/v1/node-pools/count

**Query parameters:** `filterBy` (array[string], optional).

**Response 200:** `{ "count": 0 }`

**Error responses:** 400, 401, 403, 503

---

### 5.4 GET /api/v1/node-pools/{nodepoolId}

**Path parameters:** `nodepoolId` (string, required)

**Response 200:** Nodepool object.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 5.5 PUT /api/v1/node-pools/{nodepoolId}

Full update.

**Path parameters:** `nodepoolId` (string, required)

**Request body:**
```json
{
  "labelKey": "string",
  "labelValue": "string",
  "gpuNetworkAccelerationLabelKey": "string",
  "gpuNetworkAccelerationDetection": "Auto|Use|DontUse",
  "networkTopologyId": "uuid",
  "gpuResourceOptimization": { ... },
  "schedulingConfiguration": { ... }
}
```

**Response 200:** Updated Nodepool object.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 5.6 PATCH /api/v1/node-pools/{nodepoolId}

Partial update (same body as PUT, all fields optional).

**Path parameters:** `nodepoolId` (string, required)

**Response 200:** Updated Nodepool object.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 5.7 DELETE /api/v1/node-pools/{nodepoolId}

**Path parameters:** `nodepoolId` (string, required)

**Response 202:** `{ "code": 202, "message": "string" }`
**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 5.8 GET /api/v1/clusters/{clusterUuid}/nodepools/{nodepoolName}/metrics

Nodepool metrics.

**Path parameters:** `clusterUuid` (UUID, required), `nodepoolName` (string, required)

**Query parameters:** `start`, `end` (date-time, required), `numberOfSamples` (int, default 20), `metricType` (array, required -- same enum as cluster metrics).

**Response 200/207:** Measurements array.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 5.9--5.13 Deprecated endpoints

| Method | Path | Replacement |
|---|---|---|
| GET | `/v1/k8s/clusters/{clusterId}/node-pools` | `GET /api/v1/node-pools` |
| POST | `/v1/k8s/clusters/{clusterId}/node-pools` | `POST /api/v1/node-pools` |
| PUT | `/v1/k8s/clusters/{clusterId}/node-pools/{id}/labels` | `PATCH /api/v1/node-pools/{id}` |
| PUT | `/v1/k8s/clusters/{clusterId}/node-pools/{id}` | `PATCH /api/v1/node-pools/{id}` |
| DELETE | `/v1/k8s/clusters/{clusterId}/node-pools/{id}` | `DELETE /api/v1/node-pools/{id}` |

---

## 6. Nodes API

### 6.1 GET /api/v1/nodes

List nodes from all tenant clusters.

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `filterBy` | array[string] | No | -- |
| `sortBy` | string enum | No | -- |
| `sortOrder` | string | No | `asc` |
| `offset` | integer | No | 0 |
| `limit` | integer | No | 50 (max 500) |
| `search` | string | No | -- |

**sortBy enum:** `name`, `status`, `nodePool`, `gpuType`, `nvLinkDomainUid`, `nvLinkCliqueId`, `clusterUuid`

**Response 200:**
```json
{
  "nodes": [
    {
      "id": "uuid",
      "name": "string",
      "status": "Ready|NotReady|Unknown",
      "nodePool": "string",
      "createdAt": "date-time",
      "updatedAt": "date-time",
      "clusterUuid": "uuid",
      "conditions": [
        { "type": "string", "reason": "string", "message": "string" }
      ],
      "taints": [
        { "key": "string", "value": "string", "effect": "NoSchedule|PreferNoSchedule|NoExecute" }
      ],
      "gpuInfo": {
        "gpuType": "string",
        "gpuCount": 0
      },
      "nvLinkDomainUid": "string|null",
      "nvLinkCliqueId": "string|null"
    }
  ]
}
```

**Error responses:** 401, 403, 404, 500, 503

---

### 6.2 GET /api/v1/nodes/count

**Query parameters:** `filterBy` (array, optional), `search` (string, optional).

**Response 200:** `{ "count": 42 }`

**Error responses:** 400, 401, 403, 500, 503

---

### 6.3 GET /api/v1/clusters/{clusterUuid}/nodes (DEPRECATED -- use /api/v1/nodes)

Same as 6.1 but scoped to a single cluster.

**Path parameters:** `clusterUuid` (UUID, required)

**Additional query parameter:** `nodeName` (string, optional -- cannot be used with filterBy/sort/offset/limit/search).

**Response 200:** Same as 6.1.

---

### 6.4 GET /api/v1/clusters/{clusterUuid}/nodes/count

**Path parameters:** `clusterUuid` (UUID, required)

**Query parameters:** `filterBy`, `search`.

**Response 200:** `{ "count": 42 }`

**Error responses:** 400, 401, 403, 500, 503

---

### 6.5 GET /api/v1/nodes/telemetry

Node telemetry data.

**Query parameters:**

| Name | Type | Required |
|---|---|---|
| `telemetryType` | string enum | Yes |
| `clusterId` | string (UUID) | No |
| `nodepoolName` | string | No |
| `groupBy` | array[string] (max 2) | No |

**telemetryType enum:** `READY_GPU_NODES`, `READY_GPUS`, `TOTAL_GPU_NODES`, `TOTAL_GPUS`, `IDLE_ALLOCATED_GPUS`, `FREE_GPUS`, `ALLOCATED_GPUS`, `TOTAL_CPU_CORES`, `USED_CPU_CORES`, `ALLOCATED_CPU_CORES`, `TOTAL_GPU_MEMORY_BYTES`, `USED_GPU_MEMORY_BYTES`, `TOTAL_CPU_MEMORY_BYTES`, `USED_CPU_MEMORY_BYTES`, `ALLOCATED_CPU_MEMORY_BYTES`, `FULLY_FREE_GPU_NODES`

**groupBy enum:** `ClusterId`, `Nodepool`, `Node`

**Response 200:** Telemetry values. Also supports `text/csv` response.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 6.6 GET /api/v1/nodes/{nodeId}/metrics

Node metrics.

**Path parameters:** `nodeId` (UUID, required)

**Query parameters:** `metricType` (array, required), `start`, `end` (date-time, required), `numberOfSamples` (int, default 20).

**metricType enum:** `GPU_UTILIZATION_PER_GPU`, `GPU_UTILIZATION`, `GPU_MEMORY_UTILIZATION_PER_GPU`, `GPU_MEMORY_UTILIZATION`, `GPU_MEMORY_USAGE_BYTES_PER_GPU`, `GPU_MEMORY_USAGE_BYTES`, `GPU_ALLOCATION_PER_GPU`, `GPU_MEMORY_ALLOCATION_BYTES_PER_GPU`, `GPU_IDLE_TIME_SECONDS_PER_GPU`, `CPU_USAGE_CORES`, `CPU_UTILIZATION`, `CPU_MEMORY_USAGE_BYTES`, `CPU_MEMORY_UTILIZATION`, `GPU_OOMKILL_BURST_COUNT_PER_GPU`, `GPU_OOMKILL_IDLE_COUNT_PER_GPU`, `GPU_OOMKILL_SWAP_OUT_OF_RAM_COUNT_PER_GPU`, `GPU_GRAPHICS_ENGINE_ACTIVITY_PER_GPU`, `GPU_SM_ACTIVITY_PER_GPU`, `GPU_SM_OCCUPANCY_PER_GPU`, `GPU_TENSOR_ACTIVITY_PER_GPU`, `GPU_FP64_ENGINE_ACTIVITY_PER_GPU`, `GPU_FP32_ENGINE_ACTIVITY_PER_GPU`, `GPU_FP16_ENGINE_ACTIVITY_PER_GPU`, `GPU_MEMORY_BANDWIDTH_UTILIZATION_PER_GPU`, `GPU_NVLINK_TRANSMITTED_BANDWIDTH_PER_GPU`, `GPU_NVLINK_RECEIVED_BANDWIDTH_PER_GPU`, `GPU_PCIE_TRANSMITTED_BANDWIDTH_PER_GPU`, `GPU_PCIE_RECEIVED_BANDWIDTH_PER_GPU`, `NVLINK_BANDWIDTH_TOTAL`, `NVLINK_BANDWIDTH_TOTAL_PER_GPU`

**Response 200/207:** Measurements array. Also supports `text/csv`.

**Error responses:** 400, 401, 403, 404, 500, 503

---

## 7. Tenant Settings API

### 7.1 GET /v1/k8s/setting

Get all tenant settings.

**Response 200:** Array of Setting objects:
```json
[
  {
    "active": true,
    "category": "string",
    "description": "string",
    "source": "string",
    "label": "string",
    "stage": "string",
    "type": "string",
    "key": "string",
    "value": "string"
  }
]
```

**Error responses:** 401, 403, 500, 503

---

### 7.2 PUT /v1/k8s/setting

Update a tenant setting.

**Request body:**
```json
{
  "key": "string",
  "value": "<any>"
}
```

**Response 200:** `{ "msg": "string" }`

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 7.3 GET /v1/k8s/setting/{settingKey}

Get setting by key.

**Path parameters:** `settingKey` (string, required)

**Response 200:** boolean (indicates if setting is enabled).

**Error responses:** 401, 403, 500, 503

---

## 8. Access Rules API

### 8.1 GET /api/v1/authorization/access-rules

List access rules.

**Query parameters:**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `subjectType` | string | No | -- | Filter by subject type |
| `subjectIdFilter` | string | No | -- | Partial match (deprecated) |
| `subjectIds` | array[string] | No | -- | Filter by specific IDs |
| `limit` | integer | No | 50 | 1--500 |
| `offset` | integer | No | 0 | Pagination |
| `lastUpdated` | string | No | -- | Filter by last update |
| `includeDeleted` | boolean | No | false | Include deleted |
| `clusterId` | string (UUID) | No | -- | Cluster filter |
| `scopeType` | string | No | -- | Scope type (deprecated) |
| `scopeId` | string | No | -- | Scope ID |
| `roleId` | integer | No | -- | Role filter (deprecated, min 1) |
| `sortOrder` | string | No | `asc` | asc/desc |
| `sortBy` | string | No | -- | subjectId, subjectType, roleId, scopeId, scopeType, roleName, scopeName, createdAt, deletedAt, createdBy, phase |
| `filterBy` | array[string] | No | -- | Filter format |
| `search` | string | No | -- | Free text |

**Response 200:**
```json
{
  "totalRecords": 100,
  "displayRecords": 50,
  "accessRules": [
    {
      "id": 1,
      "subjectId": "string",
      "subjectType": "user|app|service-account|group",
      "roleId": 1,
      "scopeId": "string",
      "scopeType": "system|tenant|cluster|department|project",
      "clusterId": "uuid",
      "roleName": "string",
      "scopeName": "string",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "deletedAt": null,
      "tenantId": 1,
      "createdBy": "string",
      "status": {
        "phase": "Creating|Ready|NotReady|Deleting",
        "message": "string",
        "details": "string"
      }
    }
  ]
}
```

**Error responses:** 401, 403, 500, 503

---

### 8.2 POST /api/v1/authorization/access-rules

Create access rule (bind role to subject in scope).

**Request body:**
```json
{
  "subjectId": "string (required)",
  "subjectType": "user|app|service-account|group (required)",
  "roleId": 1,
  "scopeId": "string (required)",
  "scopeType": "system|tenant|cluster|department|project (required)",
  "clusterId": "uuid (optional)"
}
```

**Response 201:** AccessRule object (same schema as list item plus `scopePath`).

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 8.3 GET /api/v1/authorization/access-rules/{accessRuleId}

**Path parameters:** `accessRuleId` (integer, min 0, required)

**Response 200:** AccessRule object (includes `scopePath`).

**Error responses:** 401, 403, 404, 500, 503

---

### 8.4 DELETE /api/v1/authorization/access-rules/{accessRuleId}

**Path parameters:** `accessRuleId` (integer, min 0, required)

**Response 204:** No content.

**Error responses:** 401, 403, 404, 500, 503

---

### 8.5 GET /api/v1/authorization/access-rules/count

**Query parameters:** `includeDeleted` (boolean), `filterBy` (array), `search` (string).

**Response 200:** `{ "count": 42 }`

**Error responses:** 400, 401, 403, 500, 503

---

### 8.6 POST /api/v1/authorization/access-rules/batch

Batch delete/validate-delete access rules.

**Request body:**
```json
{
  "ids": ["uuid"],
  "action": "delete|validate_delete"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "succeeded": ["uuid"],
  "failed": [
    { "id": "uuid", "code": 400, "message": "string" }
  ]
}
```

**Error responses:** 400, 401, 403, 500, 503

---

### 8.7 POST /api/v1/authorization/access-rules/batch-create

Batch create access rules.

**Request body:**
```json
{
  "payload": {
    "roleId": 1,
    "clusterId": "uuid (optional)",
    "subjects": [
      { "subjectId": "string", "subjectType": "user|app|service-account|group" }
    ],
    "scopes": [
      { "scopeId": "string", "scopeType": "system|tenant|cluster|department|project" }
    ]
  }
}
```

**Response 200:**
```json
{
  "succeeded": [ <AccessRule> ],
  "failed": [
    {
      "payload": { "subjectId": "", "subjectType": "", "roleId": 0, "scopeId": "", "scopeType": "", "clusterId": "" },
      "code": 400,
      "message": "string"
    }
  ]
}
```

**Error responses:** 400, 401, 403, 500, 503

---

## 9. Access Keys API

### 9.1 GET /api/v1/access-keys

List current user's access keys.

**Response 200:**
```json
{
  "accessKeys": [
    {
      "name": "string",
      "clientId": "string",
      "id": "string",
      "createdAt": "date-time|null",
      "lastLogin": "date-time|null"
    }
  ]
}
```
Array: min 0, max 100 items.

**Error responses:** 401, 403, 500, 503

---

### 9.2 POST /api/v1/access-keys

Create access key.

**Request body:**
```json
{
  "name": "string (required, pattern: ^[a-z][-_a-z0-9]*[a-z0-9]$, 2-255 chars)"
}
```

**Response 201:**
```json
{
  "id": "string",
  "clientId": "string",
  "name": "string",
  "clientSecret": "string (shown only once)",
  "createdAt": "date-time|null"
}
```

**Error responses:** 400, 401, 403, 409, 500, 503

---

### 9.3 GET /api/v1/access-keys/{accessKeyId}

**Path parameters:** `accessKeyId` (string, required)

**Response 200:** AccessKey object (without clientSecret).

**Error responses:** 401, 403, 404, 500, 503

---

### 9.4 DELETE /api/v1/access-keys/{accessKeyId}

**Path parameters:** `accessKeyId` (string, required)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 9.5 POST /api/v1/access-keys/{accessKeyId}/secret

Regenerate access key secret.

**Path parameters:** `accessKeyId` (string, required)

**Response 200:**
```json
{ "clientSecret": "string" }
```

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 9.6 GET /api/v1/administration/access-keys

Admin: list all users' access keys.

**Query parameters:**

| Name | Type | Required |
|---|---|---|
| `clientId` | string | No |
| `createdBy` | string | No |

**Response 200:**
```json
{
  "accessKeys": [
    {
      "name": "string",
      "id": "string",
      "clientId": "string",
      "createdBy": "string",
      "createdAt": "date-time|null",
      "lastLogin": "date-time|null"
    }
  ]
}
```

**Error responses:** 401, 403, 404, 500, 503

---

### 9.7 DELETE /api/v1/administration/access-keys/{accessKeyId}

Admin: delete any access key.

**Path parameters:** `accessKeyId` (string, required)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

## 10. Roles API

### 10.1 GET /api/v1/authorization/roles (DEPRECATED)

Use v2 instead.

**Response 200:** Array of RoleV1 objects.

**RoleV1:**

| Field | Type | Required |
|---|---|---|
| `id` | integer (int32) | Yes |
| `name` | string | Yes |
| `description` | string | Yes |
| `permissions` | array | Yes |
| `createdAt` | date-time | Yes |
| `updatedAt` | date-time | Yes |
| `createdBy` | string | Yes |
| `custom` | boolean | Yes |
| `effectiveEnabled` | boolean | Yes |
| `deletedAt` | date-time | No (nullable) |
| `enabled` | boolean | No (nullable) |
| `kubernetesPermissions` | object | No |

---

### 10.2 GET /api/v1/authorization/roles/{roleIdPath} (DEPRECATED)

**Path parameters:** `roleIdPath` (integer int32, min 0, required)

**Response 200:** Single RoleV1 object.

---

### 10.3 GET /api/v2/authorization/roles

List all roles (predefined + custom).

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `limit` | integer | No | 50 |
| `offset` | integer | No | 0 |
| `sortOrder` | string | No | `asc` |
| `sortBy` | string | No | -- |
| `filterBy` | array[string] | No | -- |
| `search` | string | No | -- |

**sortBy/filterBy fields:** `name`, `createdAt`, `createdBy`, `custom`, `scopeType`, `enabled`

**Response 200:**
```json
{
  "roles": [
    {
      "id": 1,
      "name": "string",
      "description": "string",
      "enabled": true,
      "custom": false,
      "effectiveEnabled": true,
      "deprecated": false,
      "createdAt": "date-time",
      "updatedAt": "date-time",
      "createdBy": "string",
      "permissionSets": [
        { "id": "uuid", "name": "string" }
      ],
      "kubernetesPermissions": {
        "predefinedRole": "string|null"
      },
      "permissions": [
        {
          "resourceType": "string",
          "actions": ["create", "read", "update", "delete"]
        }
      ]
    }
  ],
  "next": 50
}
```

**Resource types (45):** `department`, `tenant`, `project`, `cluster`, `cluster-config`, `nodepools`, `nodes`, `settings`, `security-settings`, `branding-settings`, `users`, `apps`, `service-account`, `dashboards-overview`, `dashboards-analytics`, `dashboards-consumption`, `roles`, `access_rules`, `workloads`, `workspaces`, `trainings`, `inferences`, `environments`, `pvc-assets`, `git-assets`, `host-path-assets`, `nfs-assets`, `s3-assets`, `compute-resources`, `templates`, `credentials`, `events-history`, `policies`, `cm-volume-assets`, `datavolumes`, `secret-volume-assets`, `storage-class-configuration`, `access-keys`, `workload-properties`, `network-topologies`, `registries`, `workload-integration-metrics`, `nodepools-minimal`, `clusters-minimal`

**Error responses:** 400, 401, 403, 500, 503

---

### 10.4 POST /api/v2/authorization/roles

Create custom role.

**Request body:**
```json
{
  "name": "string (required, minLength 1)",
  "description": "string (required)",
  "enabled": true,
  "permissionSets": [
    { "id": "uuid (required)", "name": "string" }
  ],
  "kubernetesPermissions": {
    "predefinedRole": "string|null"
  }
}
```

**Response 201:** Complete Role object.

**Error responses:** 400, 401, 403, 500, 503

---

### 10.5 GET /api/v2/authorization/roles/{roleIdPath}

**Path parameters:** `roleIdPath` (integer int32, min 0, required)

**Response 200:** Complete Role object.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 10.6 PUT /api/v2/authorization/roles/{roleIdPath}

Update custom role. Predefined roles cannot be updated.

**Path parameters:** `roleIdPath` (integer int32, min 0, required)

**Request body:** Same as POST.

**Response 200:** Updated Role object.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 10.7 DELETE /api/v2/authorization/roles/{roleIdPath}

Delete custom role. Predefined roles cannot be deleted.

**Path parameters:** `roleIdPath` (integer int32, min 0, required)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 10.8 POST /api/v2/authorization/roles/{roleIdPath}/enable

Enable a role.

**Path parameters:** `roleIdPath` (integer int32, min 0, required)

**Request body:** `{}` (empty object)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 10.9 POST /api/v2/authorization/roles/{roleIdPath}/disable

Disable a role.

**Path parameters:** `roleIdPath` (integer int32, min 0, required)

**Request body:** `{}` (empty object)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

## 11. Users API

### 11.1 GET /api/v1/users

List users.

**Query parameters:**

| Name | Type | Required | Default |
|---|---|---|---|
| `filter` | string | No (deprecated) | -- |
| `filterBy` | array[string] | No | -- |
| `sortBy` | string | No | -- |
| `sortOrder` | string | No | `asc` |
| `offset` | integer | No | 0 |
| `limit` | integer | No | 500 (max 500) |
| `search` | string | No | -- |

**filterBy pattern:** `^(username|createdBy|lastLogin|creationTime|lastUpdated|isLocal)(==|<=|>=|=@).+$`

**sortBy enum:** `username`, `createdBy`, `lastLogin`, `creationTime`, `lastUpdated`, `type`

**Response 200:** Array of User objects:
```json
[
  {
    "id": "string",
    "username": "string",
    "createdBy": "string",
    "createdAt": "date-time|null",
    "updatedAt": "date-time|null",
    "lastLogin": "date-time|null",
    "isLocal": true,
    "groups": ["string"]
  }
]
```

**Error responses:** 400, 401, 403, 500, 503

---

### 11.2 POST /api/v1/users

Create local user.

**Request body:**
```json
{
  "email": "string (required, valid email, 5-254 chars)",
  "resetPassword": true,
  "notify": true
}
```

**Response 201:**
```json
{
  "id": "string",
  "username": "string",
  "tempPassword": "string"
}
```

**Error responses:** 400, 401, 403, 409, 500, 503

---

### 11.3 GET /api/v1/users/count

**Query parameters:** `filterBy`, `search`.

**Response 200:** `{ "count": 42 }`

**Error responses:** 400, 401, 403, 503

---

### 11.4 POST /api/v1/users/{userId}/logout

Force user logout.

**Path parameters:** `userId` (string, required)

**Response 200:** (no body specified)

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 11.5 POST /api/v1/users/{userId}/password

Reset user password (admin).

**Path parameters:** `userId` (string, required)

**Response 200:**
```json
{ "tempPassword": "string" }
```

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 11.6 GET /api/v1/users/{userId}

Get user by ID.

**Path parameters:** `userId` (string, required)

**Response 200:** User object.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 11.7 DELETE /api/v1/users/{userId}

**Path parameters:** `userId` (string, required)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 11.8 POST /api/v1/me/password

Change own password.

**Request body:**
```json
{
  "currentPassword": "string (required, 8-255 chars)",
  "newPassword": "string (required, 8-255 chars)"
}
```

**Response 200:**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Error responses:** 400, 401, 403, 404, 500, 503

---

## 12. Service Accounts API

### 12.1 GET /api/v1/service-accounts

List service accounts.

**Response 200:** Array (0--1000 items):
```json
[
  {
    "name": "string",
    "createdBy": "string",
    "createdAt": "date-time|null",
    "updatedAt": "date-time|null",
    "enabled": true,
    "tenantId": "string",
    "lastLogin": "date-time|null",
    "id": "string",
    "clientId": "string"
  }
]
```

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 12.2 POST /api/v1/service-accounts

Create service account.

**Request body:**
```json
{
  "name": "string (required, pattern: ^[a-z][-_a-z0-9]*[a-z0-9]$, 2-255 chars)"
}
```

**Response 201:**
```json
{
  "id": "string",
  "name": "string",
  "clientSecret": "string (shown only once)",
  "clientId": "string"
}
```

**Error responses:** 400, 401, 403, 404, 409, 500, 503

---

### 12.3 GET /api/v1/service-accounts/{serviceAccountId}

**Path parameters:** `serviceAccountId` (string, required)

**Response 200:** Service account object (same as list item).

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 12.4 DELETE /api/v1/service-accounts/{serviceAccountId}

**Path parameters:** `serviceAccountId` (string, required)

**Response 204:** No content.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 12.5 PATCH /api/v1/service-accounts/{serviceAccountId}

Update (enable/disable).

**Path parameters:** `serviceAccountId` (string, required)

**Request body:**
```json
{
  "enabled": true
}
```

**Response 200:** (success)

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 12.6 POST /api/v1/service-accounts/{serviceAccountId}/secret

Regenerate secret.

**Path parameters:** `serviceAccountId` (string, required)

**Response 200:**
```json
{ "clientSecret": "string" }
```

**Error responses:** 400, 401, 403, 404, 500, 503

---

## 13. Applications API (DEPRECATED)

> Applications have been renamed to Service Accounts. Use `/api/v1/service-accounts` instead.

| Method | Path | Equivalent |
|---|---|---|
| GET | `/api/v1/apps` | `GET /api/v1/service-accounts` |
| POST | `/api/v1/apps` | `POST /api/v1/service-accounts` |
| GET | `/api/v1/apps/{appId}` | `GET /api/v1/service-accounts/{id}` |
| DELETE | `/api/v1/apps/{appId}` | `DELETE /api/v1/service-accounts/{id}` |
| PATCH | `/api/v1/apps/{appId}` | `PATCH /api/v1/service-accounts/{id}` |
| POST | `/api/v1/apps/{appId}/secret` | `POST /api/v1/service-accounts/{id}/secret` |

Schemas are identical; only difference: response field for secret creation is `secret` (apps) vs `clientSecret` (service accounts).

---

## 14. Permissions API

### 14.1 GET /api/v1/authorization/permission-sets

List all permission sets.

**Response 200:**
```json
{
  "permissionSets": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "permissions": [
        {
          "resourceType": "string",
          "actions": ["create", "read", "update", "delete"]
        }
      ]
    }
  ]
}
```

**Error responses:** 400, 401, 403, 500, 503

---

### 14.2 GET /api/v1/authorization/permission-sets/{permissionSetId}

**Path parameters:** `permissionSetId` (string UUID, required)

**Response 200:** Single PermissionSet object (same schema).

**Error responses:** 400, 401, 403, 500, 503

---

### 14.3 GET /api/v1/authorization/permissions

Get current user's permission summary.

**Response 200:**
```json
[
  {
    "resourceType": "string",
    "displayName": "string",
    "groupId": "organization|physical-resource|iam|dashboard|workload|workload-asset",
    "actions": ["create", "read", "update", "delete", "sync"]
  }
]
```

**Error responses:** 401, 500, 503

---

### 14.4 POST /api/v1/authorization/permitted-scopes

Calculate permitted scopes for an action on a resource type.

**Request body:**
```json
{
  "resourceType": "string (required)",
  "action": "create|read|update|delete (nullable)"
}
```

**Response 200:**
```json
{
  "create": {
    "system": true,
    "tenants": ["string"],
    "tenant": "string (deprecated)",
    "clusters": ["uuid"],
    "departments": ["string"],
    "projects": ["string"]
  },
  "read": { ... },
  "update": { ... },
  "delete": { ... }
}
```

**Error responses:** 401, 500, 503

---

## 15. Tokens API

### 15.1 POST /api/v1/token

Create access token (v1).

**Request body (application/json):**
```json
{
  "grantType": "app_token|client_credentials|refresh_token|exchange_token|password|external_token_exchange",
  "appID": "string (max 255, deprecated)",
  "appSecret": "string (max 500, deprecated)",
  "code": "string (max 2048)",
  "redirectUri": "string (max 2048)",
  "refreshToken": "string (max 4096)",
  "username": "string (max 255)",
  "password": "string (max 255)",
  "clientID": "string (max 255)",
  "clientSecret": "string (max 500)",
  "externalToken": "string (max 4096)"
}
```

**Grant type field requirements:**

| grantType | Required fields |
|---|---|
| `client_credentials` | `clientID`, `clientSecret` |
| `password` | `username`, `password` |
| `refresh_token` | `refreshToken` |
| `app_token` | `appID`, `appSecret` (deprecated) |
| `exchange_token` | `externalToken` |
| `external_token_exchange` | `externalToken` |

**Response 200:**
```json
{
  "accessToken": "string",
  "idToken": "string",
  "refreshToken": "string",
  "expiresIn": 86400
}
```

**Error responses:** 400, 500, 503

---

### 15.2 POST /api/v2/token

Create access token (v2, OAuth2-compliant).

**Content-Type:** `application/x-www-form-urlencoded`

**Request body fields:**

| Field | Type | Required |
|---|---|---|
| `grant_type` | string | Yes |
| `client_id` | string | Conditional |
| `client_secret` | string (password) | Conditional |
| `username` | string | Conditional |
| `password` | string (password) | Conditional |
| `refresh_token` | string | Conditional |
| `code` | string | Conditional |
| `redirect_uri` | string | Conditional |

**grant_type enum:** `authorization_code`, `client_credentials`, `password`, `refresh_token`

**Grant type field requirements:**

| grant_type | Required fields |
|---|---|
| `authorization_code` | `code`, `redirect_uri` |
| `client_credentials` | `client_id`, `client_secret` |
| `password` | `username`, `password` |
| `refresh_token` | `refresh_token` |

**Response 200:**
```json
{
  "access_token": "string",
  "token_type": "string",
  "expires_in": 86400,
  "refresh_token": "string",
  "id_token": "string",
  "scope": "string"
}
```

**Error responses:** 400, 401, 500, 503

---

### 15.3 POST /v1/k8s/auth/oauth/apptoken (DEPRECATED)

Legacy application token endpoint.

**Request body:**
```json
{
  "id": "string (max 64, required)",
  "name": "string (max 255, required)",
  "secret": "string (max 500, required)"
}
```

**Response 200:**
```json
{
  "access_token": "string",
  "id_token": "string"
}
```

**Error responses:** 400, 500, 503

---

## 16. Identity Providers (IDPs) API

### 16.1 GET /api/v1/idps

List external IDPs.

**Response 200:** Array (0--100 items) of IDP objects:

```json
[
  {
    "alias": "string (pattern: ^[a-z0-9_-]+$)",
    "type": "saml|oidc|openshift-v4",
    "redirectUri": "string",
    "samlData": {
      "signingCertificate": "string",
      "singleSignOnServiceUrl": "string",
      "entityId": "string",
      "serviceProviderMetadataUrl": "string"
    },
    "oidcData": {
      "clientId": "string",
      "clientSecret": "string",
      "discoverDocumentUrl": "string",
      "scopes": ["string"],
      "mandatoryClaim": {
        "claim": "string (pattern: .*[a-zA-Z].*, 1-255 chars)",
        "values": ["string (1-255 chars, min 1, max 100 items)"]
      }
    },
    "ocpData": {
      "idpBaseUrl": "string",
      "clientId": "string",
      "clientSecret": "string",
      "scopes": ["string"]
    },
    "mappers": {
      "alias": "string",
      "gid": "string (max 255)",
      "uid": "string (max 255)",
      "groups": "string (max 255)",
      "supplementaryGroups": "string (max 255)",
      "email": "string (max 254)"
    }
  }
]
```

**Error responses:** 401, 403, 500, 503

---

### 16.2 POST /api/v1/idps

Configure external IDP.

**Request body (IdpCreationRequest):**
```json
{
  "name": "string (max 255)",
  "type": "oidc|saml|openshift-v4 (required)",
  "samlData": {
    "metadataXmlUrl": "string (max 2048, URL pattern)",
    "metadataXmlFile": "string (max 100000 chars)",
    "fileName": "string (max 255)",
    "metadataXmlType": "url|file",
    "entityId": "string (max 2048)"
  },
  "oidcData": {
    "clientId": "string (1-255, required)",
    "clientSecret": "string (1-500, required)",
    "discoverDocumentUrl": "string (max 2048, URL pattern, required)",
    "scopes": ["string (0-50 items, each 1-100 chars)"],
    "mandatoryClaim": {
      "claim": "string (1-255 chars)",
      "values": ["string (1-100 items, each 1-255 chars)"]
    }
  },
  "ocpData": {
    "clientId": "string (1-255)",
    "idpBaseUrl": "string (max 2048, required)",
    "clientSecret": "string (1-500, required)",
    "scopes": ["string (0-50 items)"]
  },
  "mappers": {
    "alias": "string (required)",
    "gid": "string (max 255)",
    "uid": "string (max 255)",
    "groups": "string (max 255)",
    "supplementaryGroups": "string (max 255)",
    "email": "string (max 254)"
  }
}
```

**Response 201:**
```json
{ "alias": "string" }
```

**Error responses:** 400, 401, 403, 404, 409, 500, 503

---

### 16.3 GET /api/v1/idps/{idp}

**Path parameters:** `idp` (string, required -- the alias)

**Response 200:** IDP object.

**Error responses:** 401, 403, 404, 500, 503

---

### 16.4 PUT /api/v1/idps/{idp}

Update IDP.

**Path parameters:** `idp` (string, required)

**Request body:** Same as POST (IdpCreationRequest).

**Response 200:** Success message.

**Error responses:** 400, 401, 403, 404, 500, 503

---

### 16.5 DELETE /api/v1/idps/{idp}

**Path parameters:** `idp` (string, required)

**Response 200:** Success message.

**Error responses:** 401, 403, 404, 500, 503

---

### 16.6 GET /api/v1/idps/{idp}/mappers

Get IDP mappers.

**Path parameters:** `idp` (string, required)

**Response 200:** Mappers object.

**Error responses:** 401, 403, 404, 500, 503

---

### 16.7 PUT /api/v1/idps/{idp}/mappers

Update IDP mappers.

**Path parameters:** `idp` (string, required)

**Request body:** Mappers object.

**Response 202:** Accepted.

**Error responses:** 400, 401, 403, 500, 503

---

## 17. Org-Unit Utility API

### 17.1 GET /api/v1/org-unit/priorities (DEPRECATED)

Use `/api/v1/org-unit/ranks` instead.

**Response 200:**
```json
{
  "priorities": [
    { "name": "string", "value": 0, "isDefault": true }
  ]
}
```

**Error responses:** 400, 401, 403, 409, 503

---

### 17.2 GET /api/v1/org-unit/ranks

Get scheduling rank values.

**Response 200:**
```json
{
  "ranks": [
    { "name": "string", "value": 0, "isDefault": true }
  ]
}
```

**Error responses:** 400, 401, 403, 409, 503

---

## Appendix A: Complete Endpoint Index

### Clusters (9 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/clusters` |
| 2 | POST | `/api/v1/clusters` |
| 3 | GET | `/api/v1/clusters/{clusterUuid}` |
| 4 | PUT | `/api/v1/clusters/{clusterUuid}` |
| 5 | DELETE | `/api/v1/clusters/{clusterUuid}` |
| 6 | GET | `/api/v1/clusters/{clusterUuid}/metrics` |
| 7 | GET | `/api/v1/clusters/{clusterUuid}/cluster-install-info` |
| 8 | GET | `/v1/k8s/clusters/{cluster_uuid}/installfile` |
| 9 | GET | `/v1/k8s/clusters/{clusterUuid}/metrics` |

### Departments (13 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/org-unit/departments` |
| 2 | POST | `/api/v1/org-unit/departments` |
| 3 | GET | `/api/v1/org-unit/departments/{departmentId}` |
| 4 | PUT | `/api/v1/org-unit/departments/{departmentId}` |
| 5 | DELETE | `/api/v1/org-unit/departments/{departmentId}` |
| 6 | PUT | `/api/v1/org-unit/departments/{departmentId}/resources` |
| 7 | PATCH | `/api/v1/org-unit/departments/{departmentId}/resources` |
| 8 | GET | `/api/v1/org-unit/departments/{departmentId}/metrics` |
| 9 | GET | `/api/v1/org-unit/departments/telemetry` |
| 10 | GET | `/api/v1/org-unit/departments/count` |
| 11 | GET | `/api/v1/org-unit/departments/node-pool-resources` |
| 12 | GET | `/api/v1/org-unit/departments/node-pool-resources/count` |
| 13 | PATCH | `/api/v1/org-unit/departments/node-pool-resources/batch` |

### Projects (11 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/org-unit/projects` |
| 2 | POST | `/api/v1/org-unit/projects` |
| 3 | GET | `/api/v1/org-unit/projects/{projectId}` |
| 4 | PUT | `/api/v1/org-unit/projects/{projectId}` |
| 5 | DELETE | `/api/v1/org-unit/projects/{projectId}` |
| 6 | PUT | `/api/v1/org-unit/projects/{projectId}/resources` |
| 7 | PATCH | `/api/v1/org-unit/projects/{projectId}/resources` |
| 8 | GET | `/api/v1/org-unit/projects/{projectId}/metrics` |
| 9 | GET | `/api/v1/org-unit/projects/telemetry` |
| 10 | GET | `/api/v1/org-unit/projects/count` |
| 11 | GET | `/api/v1/org-unit/projects/node-pool-resources` |

### Node Pools (13 endpoints, 5 deprecated)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/node-pools` |
| 2 | POST | `/api/v1/node-pools` |
| 3 | GET | `/api/v1/node-pools/count` |
| 4 | GET | `/api/v1/node-pools/{nodepoolId}` |
| 5 | PUT | `/api/v1/node-pools/{nodepoolId}` |
| 6 | PATCH | `/api/v1/node-pools/{nodepoolId}` |
| 7 | DELETE | `/api/v1/node-pools/{nodepoolId}` |
| 8 | GET | `/api/v1/clusters/{clusterUuid}/nodepools/{nodepoolName}/metrics` |
| 9 | GET | `/v1/k8s/clusters/{clusterId}/node-pools` (deprecated) |
| 10 | POST | `/v1/k8s/clusters/{clusterId}/node-pools` (deprecated) |
| 11 | PUT | `/v1/k8s/clusters/{clusterId}/node-pools/{id}/labels` (deprecated) |
| 12 | PUT | `/v1/k8s/clusters/{clusterId}/node-pools/{id}` (deprecated) |
| 13 | DELETE | `/v1/k8s/clusters/{clusterId}/node-pools/{id}` (deprecated) |

### Nodes (6 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/nodes` |
| 2 | GET | `/api/v1/nodes/count` |
| 3 | GET | `/api/v1/clusters/{clusterUuid}/nodes` (deprecated) |
| 4 | GET | `/api/v1/clusters/{clusterUuid}/nodes/count` |
| 5 | GET | `/api/v1/nodes/telemetry` |
| 6 | GET | `/api/v1/nodes/{nodeId}/metrics` |

### Tenant Settings (3 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/v1/k8s/setting` |
| 2 | PUT | `/v1/k8s/setting` |
| 3 | GET | `/v1/k8s/setting/{settingKey}` |

### Access Rules (7 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/authorization/access-rules` |
| 2 | POST | `/api/v1/authorization/access-rules` |
| 3 | GET | `/api/v1/authorization/access-rules/{accessRuleId}` |
| 4 | DELETE | `/api/v1/authorization/access-rules/{accessRuleId}` |
| 5 | GET | `/api/v1/authorization/access-rules/count` |
| 6 | POST | `/api/v1/authorization/access-rules/batch` |
| 7 | POST | `/api/v1/authorization/access-rules/batch-create` |

### Access Keys (7 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/access-keys` |
| 2 | POST | `/api/v1/access-keys` |
| 3 | GET | `/api/v1/access-keys/{accessKeyId}` |
| 4 | DELETE | `/api/v1/access-keys/{accessKeyId}` |
| 5 | POST | `/api/v1/access-keys/{accessKeyId}/secret` |
| 6 | GET | `/api/v1/administration/access-keys` |
| 7 | DELETE | `/api/v1/administration/access-keys/{accessKeyId}` |

### Roles (9 endpoints, 2 deprecated)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/authorization/roles` (deprecated) |
| 2 | GET | `/api/v1/authorization/roles/{roleIdPath}` (deprecated) |
| 3 | GET | `/api/v2/authorization/roles` |
| 4 | POST | `/api/v2/authorization/roles` |
| 5 | GET | `/api/v2/authorization/roles/{roleIdPath}` |
| 6 | PUT | `/api/v2/authorization/roles/{roleIdPath}` |
| 7 | DELETE | `/api/v2/authorization/roles/{roleIdPath}` |
| 8 | POST | `/api/v2/authorization/roles/{roleIdPath}/enable` |
| 9 | POST | `/api/v2/authorization/roles/{roleIdPath}/disable` |

### Users (8 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/users` |
| 2 | POST | `/api/v1/users` |
| 3 | GET | `/api/v1/users/count` |
| 4 | POST | `/api/v1/users/{userId}/logout` |
| 5 | POST | `/api/v1/users/{userId}/password` |
| 6 | GET | `/api/v1/users/{userId}` |
| 7 | DELETE | `/api/v1/users/{userId}` |
| 8 | POST | `/api/v1/me/password` |

### Service Accounts (6 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/service-accounts` |
| 2 | POST | `/api/v1/service-accounts` |
| 3 | GET | `/api/v1/service-accounts/{serviceAccountId}` |
| 4 | DELETE | `/api/v1/service-accounts/{serviceAccountId}` |
| 5 | PATCH | `/api/v1/service-accounts/{serviceAccountId}` |
| 6 | POST | `/api/v1/service-accounts/{serviceAccountId}/secret` |

### Applications (6 endpoints, all deprecated)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/apps` |
| 2 | POST | `/api/v1/apps` |
| 3 | GET | `/api/v1/apps/{appId}` |
| 4 | DELETE | `/api/v1/apps/{appId}` |
| 5 | PATCH | `/api/v1/apps/{appId}` |
| 6 | POST | `/api/v1/apps/{appId}/secret` |

### Permissions (4 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/authorization/permission-sets` |
| 2 | GET | `/api/v1/authorization/permission-sets/{permissionSetId}` |
| 3 | GET | `/api/v1/authorization/permissions` |
| 4 | POST | `/api/v1/authorization/permitted-scopes` |

### Tokens (3 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | POST | `/api/v1/token` |
| 2 | POST | `/api/v2/token` |
| 3 | POST | `/v1/k8s/auth/oauth/apptoken` (deprecated) |

### IDPs (7 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/idps` |
| 2 | POST | `/api/v1/idps` |
| 3 | GET | `/api/v1/idps/{idp}` |
| 4 | PUT | `/api/v1/idps/{idp}` |
| 5 | DELETE | `/api/v1/idps/{idp}` |
| 6 | GET | `/api/v1/idps/{idp}/mappers` |
| 7 | PUT | `/api/v1/idps/{idp}/mappers` |

### Org-Unit Utilities (2 endpoints)
| # | Method | Path |
|---|---|---|
| 1 | GET | `/api/v1/org-unit/priorities` (deprecated) |
| 2 | GET | `/api/v1/org-unit/ranks` |

---

**Total: 114 endpoints** (across current + deprecated)
**Total non-deprecated: ~89 endpoints**
