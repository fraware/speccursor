output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.observability.name
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster"
  value       = aws_eks_cluster.observability.endpoint
}

output "eks_cluster_version" {
  description = "Version of the EKS cluster"
  value       = aws_eks_cluster.observability.version
}

output "eks_cluster_arn" {
  description = "ARN of the EKS cluster"
  value       = aws_eks_cluster.observability.arn
}

output "eks_cluster_certificate_authority_data" {
  description = "Certificate authority data for the EKS cluster"
  value       = aws_eks_cluster.observability.certificate_authority[0].data
  sensitive   = true
}

output "eks_node_group_name" {
  description = "Name of the EKS node group"
  value       = aws_eks_node_group.observability.node_group_name
}

output "eks_node_group_arn" {
  description = "ARN of the EKS node group"
  value       = aws_eks_node_group.observability.arn
}

output "eks_node_group_status" {
  description = "Status of the EKS node group"
  value       = aws_eks_node_group.observability.status
}

output "prometheus_service_name" {
  description = "Name of the Prometheus service"
  value       = kubernetes_service.prometheus.metadata[0].name
}

output "prometheus_service_port" {
  description = "Port of the Prometheus service"
  value       = kubernetes_service.prometheus.spec[0].port[0].port
}

output "grafana_service_name" {
  description = "Name of the Grafana service"
  value       = kubernetes_service.grafana.metadata[0].name
}

output "grafana_service_port" {
  description = "Port of the Grafana service"
  value       = kubernetes_service.grafana.spec[0].port[0].port
}

output "loki_service_name" {
  description = "Name of the Loki service"
  value       = kubernetes_service.loki.metadata[0].name
}

output "loki_service_port" {
  description = "Port of the Loki service"
  value       = kubernetes_service.loki.spec[0].port[0].port
}

output "alertmanager_service_name" {
  description = "Name of the Alertmanager service"
  value       = kubernetes_service.alertmanager.metadata[0].name
}

output "alertmanager_service_port" {
  description = "Port of the Alertmanager service"
  value       = kubernetes_service.alertmanager.spec[0].port[0].port
}

output "jaeger_service_name" {
  description = "Name of the Jaeger service"
  value       = kubernetes_service.jaeger.metadata[0].name
}

output "jaeger_service_ui_port" {
  description = "UI port of the Jaeger service"
  value       = kubernetes_service.jaeger.spec[0].port[0].port
}

output "jaeger_service_http_port" {
  description = "HTTP port of the Jaeger service"
  value       = kubernetes_service.jaeger.spec[0].port[1].port
}

output "jaeger_service_grpc_port" {
  description = "gRPC port of the Jaeger service"
  value       = kubernetes_service.jaeger.spec[0].port[2].port
}

output "monitoring_ingress_host" {
  description = "Host for the monitoring ingress"
  value       = kubernetes_ingress_v1.monitoring.spec[0].rule[0].host
}

output "monitoring_namespace" {
  description = "Kubernetes namespace for monitoring"
  value       = var.monitoring_namespace
}

output "prometheus_config_map_name" {
  description = "Name of the Prometheus ConfigMap"
  value       = kubernetes_config_map.prometheus_config.metadata[0].name
}

output "grafana_datasources_config_map_name" {
  description = "Name of the Grafana datasources ConfigMap"
  value       = kubernetes_config_map.grafana_datasources.metadata[0].name
}

output "grafana_dashboards_config_map_name" {
  description = "Name of the Grafana dashboards ConfigMap"
  value       = kubernetes_config_map.grafana_dashboards.metadata[0].name
}

output "loki_config_map_name" {
  description = "Name of the Loki ConfigMap"
  value       = kubernetes_config_map.loki_config.metadata[0].name
}

output "alertmanager_config_map_name" {
  description = "Name of the Alertmanager ConfigMap"
  value       = kubernetes_config_map.alertmanager_config.metadata[0].name
}

output "jaeger_config_map_name" {
  description = "Name of the Jaeger ConfigMap"
  value       = kubernetes_config_map.jaeger_config.metadata[0].name
}

output "prometheus_pvc_name" {
  description = "Name of the Prometheus PVC"
  value       = kubernetes_persistent_volume_claim.prometheus.metadata[0].name
}

output "grafana_pvc_name" {
  description = "Name of the Grafana PVC"
  value       = kubernetes_persistent_volume_claim.grafana.metadata[0].name
}

output "loki_pvc_name" {
  description = "Name of the Loki PVC"
  value       = kubernetes_persistent_volume_claim.loki.metadata[0].name
}

output "alertmanager_pvc_name" {
  description = "Name of the Alertmanager PVC"
  value       = kubernetes_persistent_volume_claim.alertmanager.metadata[0].name
}

output "prometheus_deployment_name" {
  description = "Name of the Prometheus deployment"
  value       = kubernetes_deployment.prometheus.metadata[0].name
}

output "grafana_deployment_name" {
  description = "Name of the Grafana deployment"
  value       = kubernetes_deployment.grafana.metadata[0].name
}

output "loki_deployment_name" {
  description = "Name of the Loki deployment"
  value       = kubernetes_deployment.loki.metadata[0].name
}

output "alertmanager_deployment_name" {
  description = "Name of the Alertmanager deployment"
  value       = kubernetes_deployment.alertmanager.metadata[0].name
}

output "jaeger_deployment_name" {
  description = "Name of the Jaeger deployment"
  value       = kubernetes_deployment.jaeger.metadata[0].name
}

output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster.arn
}

output "eks_node_group_role_arn" {
  description = "ARN of the EKS node group IAM role"
  value       = aws_iam_role.eks_node_group.arn
}

output "eks_cluster_security_group_id" {
  description = "ID of the EKS cluster security group"
  value       = aws_security_group.eks_cluster.id
}

output "eks_node_group_security_group_id" {
  description = "ID of the EKS node group security group"
  value       = aws_security_group.eks_node_group.id
}

output "monitoring_urls" {
  description = "URLs for monitoring services"
  value = {
    prometheus = "http://${kubernetes_ingress_v1.monitoring.spec[0].rule[0].host}/prometheus"
    grafana    = "http://${kubernetes_ingress_v1.monitoring.spec[0].rule[0].host}/grafana"
    jaeger     = "http://${kubernetes_ingress_v1.monitoring.spec[0].rule[0].host}/jaeger"
  }
}

output "kubeconfig_command" {
  description = "Command to configure kubectl for the EKS cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.observability.name}"
}

output "helm_repo_add_commands" {
  description = "Commands to add Helm repositories for monitoring stack"
  value = {
    prometheus = "helm repo add prometheus-community https://prometheus-community.github.io/helm-charts"
    grafana    = "helm repo add grafana https://grafana.github.io/helm-charts"
    loki       = "helm repo add grafana https://grafana.github.io/helm-charts"
    jaeger     = "helm repo add jaegertracing https://jaegertracing.github.io/helm-charts"
  }
}

output "helm_install_commands" {
  description = "Commands to install monitoring stack with Helm"
  value = {
    prometheus = "helm install prometheus prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace"
    grafana    = "helm install grafana grafana/grafana --namespace monitoring --create-namespace"
    loki       = "helm install loki grafana/loki --namespace monitoring --create-namespace"
    jaeger     = "helm install jaeger jaegertracing/jaeger --namespace monitoring --create-namespace"
  }
}

output "monitoring_dashboard_urls" {
  description = "Dashboard URLs for monitoring services"
  value = {
    prometheus_targets = "http://${kubernetes_ingress_v1.monitoring.spec[0].rule[0].host}/prometheus/targets"
    prometheus_alerts  = "http://${kubernetes_ingress_v1.monitoring.spec[0].rule[0].host}/prometheus/alerts"
    grafana_dashboards = "http://${kubernetes_ingress_v1.monitoring.spec[0].rule[0].host}/grafana/dashboards"
    jaeger_search      = "http://${kubernetes_ingress_v1.monitoring.spec[0].rule[0].host}/jaeger/search"
  }
}

output "alertmanager_slack_channel" {
  description = "Slack channel for Alertmanager notifications"
  value       = var.alertmanager_slack_channel
}

output "prometheus_retention_days" {
  description = "Number of days to retain Prometheus data"
  value       = var.prometheus_retention_days
}

output "loki_retention_days" {
  description = "Number of days to retain Loki logs"
  value       = var.loki_retention_days
}

output "monitoring_storage_sizes" {
  description = "Storage sizes for monitoring components"
  value = {
    prometheus   = var.prometheus_storage_size
    grafana      = var.grafana_storage_size
    loki         = var.loki_storage_size
    alertmanager = var.alertmanager_storage_size
  }
}

output "monitoring_replicas" {
  description = "Number of replicas for monitoring components"
  value = {
    prometheus   = var.prometheus_replicas
    grafana      = var.grafana_replicas
    loki         = var.loki_replicas
    alertmanager = var.alertmanager_replicas
    jaeger       = var.jaeger_replicas
  }
}

output "eks_node_group_scaling" {
  description = "Scaling configuration for EKS node group"
  value = {
    desired_size = var.eks_node_desired_size
    max_size     = var.eks_node_max_size
    min_size     = var.eks_node_min_size
  }
}

output "eks_node_instance_types" {
  description = "Instance types for EKS nodes"
  value       = var.eks_node_instance_types
}

output "monitoring_features" {
  description = "Enabled monitoring features"
  value = {
    ingress_enabled     = var.enable_ingress
    ssl_enabled         = var.enable_ssl
    backup_enabled      = var.enable_backup
    encryption_enabled  = var.enable_encryption
    autoscaling_enabled = var.enable_autoscaling
    jaeger_enabled      = var.enable_jaeger_tracing
    opentelemetry_enabled = var.enable_opentelemetry
  }
}

output "monitoring_security" {
  description = "Security configuration for monitoring stack"
  value = {
    network_policies_enabled     = var.enable_network_policies
    pod_security_policies_enabled = var.enable_pod_security_policies
    audit_logging_enabled        = var.enable_audit_logging
    cloudwatch_logs_enabled      = var.enable_cloudwatch_logs
  }
}

output "monitoring_autoscaling" {
  description = "Autoscaling configuration for monitoring stack"
  value = {
    min_replicas                    = var.autoscaling_min_replicas
    max_replicas                    = var.autoscaling_max_replicas
    target_cpu_utilization          = var.autoscaling_target_cpu_utilization
    target_memory_utilization       = var.autoscaling_target_memory_utilization
  }
}

output "monitoring_resource_quotas" {
  description = "Resource quotas for monitoring namespace"
  value = {
    cpu_limit    = var.monitoring_cpu_limit
    memory_limit = var.monitoring_memory_limit
    pods_limit   = var.monitoring_pods_limit
  }
}

output "monitoring_components" {
  description = "List of monitoring components deployed"
  value = [
    "prometheus",
    "grafana", 
    "loki",
    "alertmanager",
    "jaeger"
  ]
}

output "monitoring_namespaces" {
  description = "Kubernetes namespaces used by monitoring stack"
  value = [
    var.monitoring_namespace
  ]
}

output "monitoring_services" {
  description = "Kubernetes services in monitoring stack"
  value = [
    kubernetes_service.prometheus.metadata[0].name,
    kubernetes_service.grafana.metadata[0].name,
    kubernetes_service.loki.metadata[0].name,
    kubernetes_service.alertmanager.metadata[0].name,
    kubernetes_service.jaeger.metadata[0].name
  ]
}

output "monitoring_deployments" {
  description = "Kubernetes deployments in monitoring stack"
  value = [
    kubernetes_deployment.prometheus.metadata[0].name,
    kubernetes_deployment.grafana.metadata[0].name,
    kubernetes_deployment.loki.metadata[0].name,
    kubernetes_deployment.alertmanager.metadata[0].name,
    kubernetes_deployment.jaeger.metadata[0].name
  ]
}

output "monitoring_config_maps" {
  description = "Kubernetes ConfigMaps in monitoring stack"
  value = [
    kubernetes_config_map.prometheus_config.metadata[0].name,
    kubernetes_config_map.grafana_datasources.metadata[0].name,
    kubernetes_config_map.grafana_dashboards.metadata[0].name,
    kubernetes_config_map.loki_config.metadata[0].name,
    kubernetes_config_map.alertmanager_config.metadata[0].name,
    kubernetes_config_map.jaeger_config.metadata[0].name
  ]
}

output "monitoring_persistent_volume_claims" {
  description = "Kubernetes PVCs in monitoring stack"
  value = [
    kubernetes_persistent_volume_claim.prometheus.metadata[0].name,
    kubernetes_persistent_volume_claim.grafana.metadata[0].name,
    kubernetes_persistent_volume_claim.loki.metadata[0].name,
    kubernetes_persistent_volume_claim.alertmanager.metadata[0].name
  ]
}

output "monitoring_ingress_rules" {
  description = "Ingress rules for monitoring services"
  value = [
    for path in kubernetes_ingress_v1.monitoring.spec[0].rule[0].http[0].path : {
      path     = path.path
      path_type = path.path_type
      service  = path.backend[0].service[0].name
      port     = path.backend[0].service[0].port[0].number
    }
  ]
}

output "monitoring_iam_roles" {
  description = "IAM roles for monitoring stack"
  value = {
    cluster_role_arn = aws_iam_role.eks_cluster.arn
    node_group_role_arn = aws_iam_role.eks_node_group.arn
  }
}

output "monitoring_security_groups" {
  description = "Security groups for monitoring stack"
  value = {
    cluster_sg_id = aws_security_group.eks_cluster.id
    node_group_sg_id = aws_security_group.eks_node_group.id
  }
}

output "monitoring_tags" {
  description = "Tags applied to monitoring resources"
  value       = var.tags
}

output "monitoring_domain" {
  description = "Domain name for monitoring ingress"
  value       = var.domain_name
}

output "monitoring_region" {
  description = "AWS region for monitoring resources"
  value       = var.aws_region
}

output "monitoring_project" {
  description = "Project name for monitoring resources"
  value       = var.project_name
} 