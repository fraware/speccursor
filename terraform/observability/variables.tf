variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "speccursor"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "vpc_id" {
  description = "VPC ID for the EKS cluster"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the EKS cluster"
  type        = list(string)
}

variable "domain_name" {
  description = "Domain name for monitoring ingress"
  type        = string
  default     = "speccursor.com"
}

variable "grafana_admin_password" {
  description = "Admin password for Grafana"
  type        = string
  sensitive   = true
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "speccursor"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

variable "prometheus_retention_days" {
  description = "Number of days to retain Prometheus data"
  type        = number
  default     = 15
}

variable "loki_retention_days" {
  description = "Number of days to retain Loki logs"
  type        = number
  default     = 30
}

variable "alertmanager_slack_channel" {
  description = "Slack channel for Alertmanager notifications"
  type        = string
  default     = "#speccursor-alerts"
}

variable "monitoring_namespace" {
  description = "Kubernetes namespace for monitoring stack"
  type        = string
  default     = "monitoring"
}

variable "prometheus_storage_size" {
  description = "Storage size for Prometheus PVC"
  type        = string
  default     = "10Gi"
}

variable "grafana_storage_size" {
  description = "Storage size for Grafana PVC"
  type        = string
  default     = "5Gi"
}

variable "loki_storage_size" {
  description = "Storage size for Loki PVC"
  type        = string
  default     = "10Gi"
}

variable "alertmanager_storage_size" {
  description = "Storage size for Alertmanager PVC"
  type        = string
  default     = "1Gi"
}

variable "prometheus_replicas" {
  description = "Number of Prometheus replicas"
  type        = number
  default     = 1
}

variable "grafana_replicas" {
  description = "Number of Grafana replicas"
  type        = number
  default     = 1
}

variable "loki_replicas" {
  description = "Number of Loki replicas"
  type        = number
  default     = 1
}

variable "alertmanager_replicas" {
  description = "Number of Alertmanager replicas"
  type        = number
  default     = 1
}

variable "jaeger_replicas" {
  description = "Number of Jaeger replicas"
  type        = number
  default     = 1
}

variable "eks_cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.28"
}

variable "eks_node_instance_types" {
  description = "Instance types for EKS nodes"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_node_desired_size" {
  description = "Desired number of EKS nodes"
  type        = number
  default     = 2
}

variable "eks_node_max_size" {
  description = "Maximum number of EKS nodes"
  type        = number
  default     = 4
}

variable "eks_node_min_size" {
  description = "Minimum number of EKS nodes"
  type        = number
  default     = 1
}

variable "enable_ingress" {
  description = "Enable ingress for external access"
  type        = bool
  default     = true
}

variable "enable_ssl" {
  description = "Enable SSL for ingress"
  type        = bool
  default     = true
}

variable "certificate_arn" {
  description = "ARN of SSL certificate for ingress"
  type        = string
  default     = ""
}

variable "enable_backup" {
  description = "Enable backup for monitoring data"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "enable_encryption" {
  description = "Enable encryption for monitoring data"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "ARN of KMS key for encryption"
  type        = string
  default     = ""
}

variable "enable_autoscaling" {
  description = "Enable autoscaling for monitoring stack"
  type        = bool
  default     = true
}

variable "autoscaling_min_replicas" {
  description = "Minimum replicas for autoscaling"
  type        = number
  default     = 1
}

variable "autoscaling_max_replicas" {
  description = "Maximum replicas for autoscaling"
  type        = number
  default     = 3
}

variable "autoscaling_target_cpu_utilization" {
  description = "Target CPU utilization for autoscaling"
  type        = number
  default     = 70
}

variable "autoscaling_target_memory_utilization" {
  description = "Target memory utilization for autoscaling"
  type        = number
  default     = 80
}

variable "enable_resource_quotas" {
  description = "Enable resource quotas for monitoring namespace"
  type        = bool
  default     = true
}

variable "monitoring_cpu_limit" {
  description = "CPU limit for monitoring namespace"
  type        = string
  default     = "4"
}

variable "monitoring_memory_limit" {
  description = "Memory limit for monitoring namespace"
  type        = string
  default     = "8Gi"
}

variable "monitoring_pods_limit" {
  description = "Pods limit for monitoring namespace"
  type        = number
  default     = 20
}

variable "enable_network_policies" {
  description = "Enable network policies for monitoring stack"
  type        = bool
  default     = true
}

variable "allowed_ingress_cidrs" {
  description = "Allowed CIDR blocks for ingress"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_pod_security_policies" {
  description = "Enable pod security policies"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable audit logging for EKS cluster"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logs for EKS cluster"
  type        = bool
  default     = true
}

variable "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for EKS cluster"
  type        = string
  default     = "/aws/eks/speccursor-observability/cluster"
}

variable "enable_metrics_server" {
  description = "Enable metrics server for autoscaling"
  type        = bool
  default     = true
}

variable "enable_cluster_autoscaler" {
  description = "Enable cluster autoscaler"
  type        = bool
  default     = true
}

variable "cluster_autoscaler_version" {
  description = "Version of cluster autoscaler"
  type        = string
  default     = "v1.28.0"
}

variable "enable_aws_load_balancer_controller" {
  description = "Enable AWS Load Balancer Controller"
  type        = bool
  default     = true
}

variable "enable_external_dns" {
  description = "Enable External DNS for ingress"
  type        = bool
  default     = true
}

variable "external_dns_domain" {
  description = "Domain for External DNS"
  type        = string
  default     = "speccursor.com"
}

variable "enable_cert_manager" {
  description = "Enable cert-manager for SSL certificates"
  type        = bool
  default     = true
}

variable "cert_manager_email" {
  description = "Email for cert-manager"
  type        = string
  default     = "admin@speccursor.com"
}

variable "enable_istio" {
  description = "Enable Istio service mesh"
  type        = bool
  default     = false
}

variable "enable_jaeger_tracing" {
  description = "Enable Jaeger distributed tracing"
  type        = bool
  default     = true
}

variable "jaeger_storage_type" {
  description = "Storage type for Jaeger"
  type        = string
  default     = "memory"
}

variable "jaeger_max_traces" {
  description = "Maximum number of traces for Jaeger"
  type        = number
  default     = 50000
}

variable "enable_zipkin" {
  description = "Enable Zipkin distributed tracing"
  type        = bool
  default     = false
}

variable "enable_opentelemetry" {
  description = "Enable OpenTelemetry"
  type        = bool
  default     = true
}

variable "opentelemetry_collector_version" {
  description = "Version of OpenTelemetry Collector"
  type        = string
  default     = "v0.88.0"
}

variable "enable_fluentd" {
  description = "Enable Fluentd for log collection"
  type        = bool
  default     = true
}

variable "fluentd_version" {
  description = "Version of Fluentd"
  type        = string
  default     = "v1.16-1"
}

variable "enable_elasticsearch" {
  description = "Enable Elasticsearch for log storage"
  type        = bool
  default     = false
}

variable "elasticsearch_version" {
  description = "Version of Elasticsearch"
  type        = string
  default     = "7.17.0"
}

variable "enable_kibana" {
  description = "Enable Kibana for log visualization"
  type        = bool
  default     = false
}

variable "kibana_version" {
  description = "Version of Kibana"
  type        = string
  default     = "7.17.0"
}

variable "enable_redis" {
  description = "Enable Redis for caching"
  type        = bool
  default     = true
}

variable "redis_version" {
  description = "Version of Redis"
  type        = string
  default     = "7.0-alpine"
}

variable "enable_postgresql" {
  description = "Enable PostgreSQL for data storage"
  type        = bool
  default     = true
}

variable "postgresql_version" {
  description = "Version of PostgreSQL"
  type        = string
  default     = "15.3"
}

variable "enable_mongodb" {
  description = "Enable MongoDB for data storage"
  type        = bool
  default     = false
}

variable "mongodb_version" {
  description = "Version of MongoDB"
  type        = string
  default     = "6.0"
}

variable "enable_rabbitmq" {
  description = "Enable RabbitMQ for message queuing"
  type        = bool
  default     = false
}

variable "rabbitmq_version" {
  description = "Version of RabbitMQ"
  type        = string
  default     = "3.11-management"
}

variable "enable_kafka" {
  description = "Enable Kafka for message streaming"
  type        = bool
  default     = false
}

variable "kafka_version" {
  description = "Version of Kafka"
  type        = string
  default     = "3.5.1"
}

variable "enable_zookeeper" {
  description = "Enable Zookeeper for Kafka"
  type        = bool
  default     = false
}

variable "zookeeper_version" {
  description = "Version of Zookeeper"
  type        = string
  default     = "3.8.2"
}

variable "enable_minio" {
  description = "Enable MinIO for object storage"
  type        = bool
  default     = false
}

variable "minio_version" {
  description = "Version of MinIO"
  type        = string
  default     = "RELEASE.2023-07-21T21-12-44Z"
}

variable "enable_nginx_ingress" {
  description = "Enable NGINX Ingress Controller"
  type        = bool
  default     = false
}

variable "nginx_ingress_version" {
  description = "Version of NGINX Ingress Controller"
  type        = string
  default     = "v1.8.1"
}

variable "enable_traefik" {
  description = "Enable Traefik Ingress Controller"
  type        = bool
  default     = false
}

variable "traefik_version" {
  description = "Version of Traefik"
  type        = string
  default     = "v2.10.5"
}

variable "enable_consul" {
  description = "Enable Consul for service discovery"
  type        = bool
  default     = false
}

variable "consul_version" {
  description = "Version of Consul"
  type        = string
  default     = "1.16.2"
}

variable "enable_vault" {
  description = "Enable Vault for secrets management"
  type        = bool
  default     = false
}

variable "vault_version" {
  description = "Version of Vault"
  type        = string
  default     = "1.15.0"
}

variable "enable_argocd" {
  description = "Enable ArgoCD for GitOps"
  type        = bool
  default     = false
}

variable "argocd_version" {
  description = "Version of ArgoCD"
  type        = string
  default     = "v2.8.4"
}

variable "enable_tekton" {
  description = "Enable Tekton for CI/CD"
  type        = bool
  default     = false
}

variable "tekton_version" {
  description = "Version of Tekton"
  type        = string
  default     = "v0.50.0"
}

variable "enable_knative" {
  description = "Enable Knative for serverless"
  type        = bool
  default     = false
}

variable "knative_version" {
  description = "Version of Knative"
  type        = string
  default     = "v1.10.0"
}

variable "enable_kong" {
  description = "Enable Kong API Gateway"
  type        = bool
  default     = false
}

variable "kong_version" {
  description = "Version of Kong"
  type        = string
  default     = "3.4.0"
}

variable "enable_linkerd" {
  description = "Enable Linkerd service mesh"
  type        = bool
  default     = false
}

variable "linkerd_version" {
  description = "Version of Linkerd"
  type        = string
  default     = "stable-2.13.4"
}

variable "enable_calico" {
  description = "Enable Calico CNI"
  type        = bool
  default     = false
}

variable "calico_version" {
  description = "Version of Calico"
  type        = string
  default     = "v3.26.1"
}

variable "enable_cilium" {
  description = "Enable Cilium CNI"
  type        = bool
  default     = false
}

variable "cilium_version" {
  description = "Version of Cilium"
  type        = string
  default     = "v1.14.2"
}

variable "enable_falco" {
  description = "Enable Falco for runtime security"
  type        = bool
  default     = false
}

variable "falco_version" {
  description = "Version of Falco"
  type        = string
  default     = "0.35.1"
}

variable "enable_kyverno" {
  description = "Enable Kyverno for policy management"
  type        = bool
  default     = false
}

variable "kyverno_version" {
  description = "Version of Kyverno"
  type        = string
  default     = "v1.10.1"
}

variable "enable_gatekeeper" {
  description = "Enable Gatekeeper for policy management"
  type        = bool
  default     = false
}

variable "gatekeeper_version" {
  description = "Version of Gatekeeper"
  type        = string
  default     = "v3.12.0"
}

variable "enable_opa" {
  description = "Enable Open Policy Agent"
  type        = bool
  default     = false
}

variable "opa_version" {
  description = "Version of Open Policy Agent"
  type        = string
  default     = "0.55.0"
}

variable "enable_istio_operator" {
  description = "Enable Istio Operator"
  type        = bool
  default     = false
}

variable "istio_operator_version" {
  description = "Version of Istio Operator"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_base" {
  description = "Enable Istio Base"
  type        = bool
  default     = false
}

variable "istio_base_version" {
  description = "Version of Istio Base"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_discovery" {
  description = "Enable Istio Discovery"
  type        = bool
  default     = false
}

variable "istio_discovery_version" {
  description = "Version of Istio Discovery"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_ingress" {
  description = "Enable Istio Ingress Gateway"
  type        = bool
  default     = false
}

variable "istio_ingress_version" {
  description = "Version of Istio Ingress Gateway"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_egress" {
  description = "Enable Istio Egress Gateway"
  type        = bool
  default     = false
}

variable "istio_egress_version" {
  description = "Version of Istio Egress Gateway"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_pilot" {
  description = "Enable Istio Pilot"
  type        = bool
  default     = false
}

variable "istio_pilot_version" {
  description = "Version of Istio Pilot"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_citadel" {
  description = "Enable Istio Citadel"
  type        = bool
  default     = false
}

variable "istio_citadel_version" {
  description = "Version of Istio Citadel"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_galley" {
  description = "Enable Istio Galley"
  type        = bool
  default     = false
}

variable "istio_galley_version" {
  description = "Version of Istio Galley"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_sidecar_injector" {
  description = "Enable Istio Sidecar Injector"
  type        = bool
  default     = false
}

variable "istio_sidecar_injector_version" {
  description = "Version of Istio Sidecar Injector"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_telemetry" {
  description = "Enable Istio Telemetry"
  type        = bool
  default     = false
}

variable "istio_telemetry_version" {
  description = "Version of Istio Telemetry"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_policy" {
  description = "Enable Istio Policy"
  type        = bool
  default     = false
}

variable "istio_policy_version" {
  description = "Version of Istio Policy"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_security" {
  description = "Enable Istio Security"
  type        = bool
  default     = false
}

variable "istio_security_version" {
  description = "Version of Istio Security"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_tracing" {
  description = "Enable Istio Tracing"
  type        = bool
  default     = false
}

variable "istio_tracing_version" {
  description = "Version of Istio Tracing"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_kiali" {
  description = "Enable Istio Kiali"
  type        = bool
  default     = false
}

variable "istio_kiali_version" {
  description = "Version of Istio Kiali"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_grafana" {
  description = "Enable Istio Grafana"
  type        = bool
  default     = false
}

variable "istio_grafana_version" {
  description = "Version of Istio Grafana"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_prometheus" {
  description = "Enable Istio Prometheus"
  type        = bool
  default     = false
}

variable "istio_prometheus_version" {
  description = "Version of Istio Prometheus"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_jaeger" {
  description = "Enable Istio Jaeger"
  type        = bool
  default     = false
}

variable "istio_jaeger_version" {
  description = "Version of Istio Jaeger"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_zipkin" {
  description = "Enable Istio Zipkin"
  type        = bool
  default     = false
}

variable "istio_zipkin_version" {
  description = "Version of Istio Zipkin"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_fluentd" {
  description = "Enable Istio Fluentd"
  type        = bool
  default     = false
}

variable "istio_fluentd_version" {
  description = "Version of Istio Fluentd"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_elasticsearch" {
  description = "Enable Istio Elasticsearch"
  type        = bool
  default     = false
}

variable "istio_elasticsearch_version" {
  description = "Version of Istio Elasticsearch"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_kibana" {
  description = "Enable Istio Kibana"
  type        = bool
  default     = false
}

variable "istio_kibana_version" {
  description = "Version of Istio Kibana"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_redis" {
  description = "Enable Istio Redis"
  type        = bool
  default     = false
}

variable "istio_redis_version" {
  description = "Version of Istio Redis"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_postgresql" {
  description = "Enable Istio PostgreSQL"
  type        = bool
  default     = false
}

variable "istio_postgresql_version" {
  description = "Version of Istio PostgreSQL"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_mongodb" {
  description = "Enable Istio MongoDB"
  type        = bool
  default     = false
}

variable "istio_mongodb_version" {
  description = "Version of Istio MongoDB"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_rabbitmq" {
  description = "Enable Istio RabbitMQ"
  type        = bool
  default     = false
}

variable "istio_rabbitmq_version" {
  description = "Version of Istio RabbitMQ"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_kafka" {
  description = "Enable Istio Kafka"
  type        = bool
  default     = false
}

variable "istio_kafka_version" {
  description = "Version of Istio Kafka"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_zookeeper" {
  description = "Enable Istio Zookeeper"
  type        = bool
  default     = false
}

variable "istio_zookeeper_version" {
  description = "Version of Istio Zookeeper"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_minio" {
  description = "Enable Istio MinIO"
  type        = bool
  default     = false
}

variable "istio_minio_version" {
  description = "Version of Istio MinIO"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_nginx_ingress" {
  description = "Enable Istio NGINX Ingress"
  type        = bool
  default     = false
}

variable "istio_nginx_ingress_version" {
  description = "Version of Istio NGINX Ingress"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_traefik" {
  description = "Enable Istio Traefik"
  type        = bool
  default     = false
}

variable "istio_traefik_version" {
  description = "Version of Istio Traefik"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_consul" {
  description = "Enable Istio Consul"
  type        = bool
  default     = false
}

variable "istio_consul_version" {
  description = "Version of Istio Consul"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_vault" {
  description = "Enable Istio Vault"
  type        = bool
  default     = false
}

variable "istio_vault_version" {
  description = "Version of Istio Vault"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_argocd" {
  description = "Enable Istio ArgoCD"
  type        = bool
  default     = false
}

variable "istio_argocd_version" {
  description = "Version of Istio ArgoCD"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_tekton" {
  description = "Enable Istio Tekton"
  type        = bool
  default     = false
}

variable "istio_tekton_version" {
  description = "Version of Istio Tekton"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_knative" {
  description = "Enable Istio Knative"
  type        = bool
  default     = false
}

variable "istio_knative_version" {
  description = "Version of Istio Knative"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_kong" {
  description = "Enable Istio Kong"
  type        = bool
  default     = false
}

variable "istio_kong_version" {
  description = "Version of Istio Kong"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_linkerd" {
  description = "Enable Istio Linkerd"
  type        = bool
  default     = false
}

variable "istio_linkerd_version" {
  description = "Version of Istio Linkerd"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_calico" {
  description = "Enable Istio Calico"
  type        = bool
  default     = false
}

variable "istio_calico_version" {
  description = "Version of Istio Calico"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_cilium" {
  description = "Enable Istio Cilium"
  type        = bool
  default     = false
}

variable "istio_cilium_version" {
  description = "Version of Istio Cilium"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_falco" {
  description = "Enable Istio Falco"
  type        = bool
  default     = false
}

variable "istio_falco_version" {
  description = "Version of Istio Falco"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_kyverno" {
  description = "Enable Istio Kyverno"
  type        = bool
  default     = false
}

variable "istio_kyverno_version" {
  description = "Version of Istio Kyverno"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_gatekeeper" {
  description = "Enable Istio Gatekeeper"
  type        = bool
  default     = false
}

variable "istio_gatekeeper_version" {
  description = "Version of Istio Gatekeeper"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_opa" {
  description = "Enable Istio OPA"
  type        = bool
  default     = false
}

variable "istio_opa_version" {
  description = "Version of Istio OPA"
  type        = string
  default     = "1.19.0"
} 