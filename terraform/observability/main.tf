terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# EKS Cluster for Observability Stack
resource "aws_eks_cluster" "observability" {
  name     = "${var.project_name}-observability"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.28"

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller,
  ]

  tags = var.tags
}

# EKS Node Group
resource "aws_eks_node_group" "observability" {
  cluster_name    = aws_eks_cluster.observability.name
  node_group_name = "observability-nodes"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = var.subnet_ids
  instance_types  = ["t3.medium"]

  scaling_config {
    desired_size = 2
    max_size     = 4
    min_size     = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.ec2_container_registry_read_only,
  ]

  tags = var.tags
}

# Prometheus Configuration
resource "kubernetes_config_map" "prometheus_config" {
  metadata {
    name      = "prometheus-config"
    namespace = "monitoring"
  }

  data = {
    "prometheus.yml" = yamlencode({
      global = {
        scrape_interval = "15s"
        evaluation_interval = "15s"
      }
      rule_files = [
        "/etc/prometheus/rules/*.yml"
      ]
      scrape_configs = [
        {
          job_name = "kubernetes-pods"
          kubernetes_sd_configs = [
            {
              role = "pod"
            }
          ]
          relabel_configs = [
            {
              source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"]
              action       = "keep"
              regex        = "true"
            },
            {
              source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_path"]
              action       = "replace"
              target_label = "__metrics_path__"
              regex        = "(.+)"
            },
            {
              source_labels = ["__address__", "__meta_kubernetes_pod_annotation_prometheus_io_port"]
              action       = "replace"
              regex        = "([^:]+)(?::\\d+)?;(\\d+)"
              replacement  = "$$1:$$2"
              target_label = "__address__"
            },
            {
              action = "labelmap"
              regex  = "__meta_kubernetes_pod_label_(.+)"
            },
            {
              source_labels = ["__meta_kubernetes_namespace"]
              action       = "replace"
              target_label = "kubernetes_namespace"
            },
            {
              source_labels = ["__meta_kubernetes_pod_name"]
              action       = "replace"
              target_label = "kubernetes_pod_name"
            }
          ]
        },
        {
          job_name = "speccursor-services"
          static_configs = [
            {
              targets = [
                "github-app:3000",
                "controller:3001", 
                "ai-service:3002",
                "rust-worker:8080",
                "lean-engine:8081"
              ]
              labels = {
                service = "speccursor"
              }
            }
          ]
          metrics_path = "/metrics"
          scrape_interval = "30s"
        }
      ]
    })
  }
}

# Prometheus Deployment
resource "kubernetes_deployment" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = "monitoring"
    labels = {
      app = "prometheus"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "prometheus"
      }
    }

    template {
      metadata {
        labels = {
          app = "prometheus"
        }
      }

      spec {
        container {
          name  = "prometheus"
          image = "prom/prometheus:v2.45.0"

          args = [
            "--config.file=/etc/prometheus/prometheus.yml",
            "--storage.tsdb.path=/prometheus",
            "--web.console.libraries=/etc/prometheus/console_libraries",
            "--web.console.templates=/etc/prometheus/consoles",
            "--storage.tsdb.retention.time=200h",
            "--web.enable-lifecycle"
          ]

          port {
            container_port = 9090
          }

          volume_mount {
            name       = "prometheus-config"
            mount_path = "/etc/prometheus"
          }

          volume_mount {
            name       = "prometheus-storage"
            mount_path = "/prometheus"
          }

          resources {
            limits = {
              cpu    = "1000m"
              memory = "2Gi"
            }
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }
        }

        volume {
          name = "prometheus-config"
          config_map {
            name = kubernetes_config_map.prometheus_config.metadata[0].name
          }
        }

        volume {
          name = "prometheus-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.prometheus.metadata[0].name
          }
        }
      }
    }
  }
}

# Prometheus PVC
resource "kubernetes_persistent_volume_claim" "prometheus" {
  metadata {
    name      = "prometheus-storage"
    namespace = "monitoring"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "10Gi"
      }
    }
    storage_class_name = "gp2"
  }
}

# Prometheus Service
resource "kubernetes_service" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = "monitoring"
    labels = {
      app = "prometheus"
    }
  }

  spec {
    selector = {
      app = "prometheus"
    }

    port {
      port        = 9090
      target_port = 9090
    }

    type = "ClusterIP"
  }
}

# Grafana Configuration
resource "kubernetes_config_map" "grafana_datasources" {
  metadata {
    name      = "grafana-datasources"
    namespace = "monitoring"
  }

  data = {
    "datasources.yml" = yamlencode({
      apiVersion = 1
      datasources = [
        {
          name  = "Prometheus"
          type  = "prometheus"
          url   = "http://prometheus:9090"
          access = "proxy"
          isDefault = true
        },
        {
          name  = "Loki"
          type  = "loki"
          url   = "http://loki:3100"
          access = "proxy"
        }
      ]
    })
  }
}

# Grafana Dashboard ConfigMap
resource "kubernetes_config_map" "grafana_dashboards" {
  metadata {
    name      = "grafana-dashboards"
    namespace = "monitoring"
  }

  data = {
    "speccursor-overview.json" = jsonencode({
      dashboard = {
        id = null
        title = "SpecCursor Overview"
        tags = ["speccursor"]
        style = "dark"
        timezone = "browser"
        refresh = "30s"
        schemaVersion = 16
        version = 1
        time = {
          from = "now-1h"
          to = "now"
        }
        panels = [
          {
            id = 1
            title = "Service Health"
            type = "stat"
            gridPos = {
              h = 8
              w = 12
              x = 0
              y = 0
            }
            targets = [
              {
                expr = "up{service=\"speccursor\"}"
                refId = "A"
              }
            ]
          },
          {
            id = 2
            title = "Request Rate"
            type = "graph"
            gridPos = {
              h = 8
              w = 12
              x = 12
              y = 0
            }
            targets = [
              {
                expr = "rate(http_requests_total{service=\"speccursor\"}[5m])"
                refId = "A"
              }
            ]
          },
          {
            id = 3
            title = "Error Rate"
            type = "graph"
            gridPos = {
              h = 8
              w = 12
              x = 0
              y = 8
            }
            targets = [
              {
                expr = "rate(http_requests_total{service=\"speccursor\", status=~\"5..\"}[5m])"
                refId = "A"
              }
            ]
          },
          {
            id = 4
            title = "AI Patch Generation Success Rate"
            type = "stat"
            gridPos = {
              h = 8
              w = 12
              x = 12
              y = 8
            }
            targets = [
              {
                expr = "rate(ai_patch_success_total[5m]) / rate(ai_patch_attempts_total[5m]) * 100"
                refId = "A"
              }
            ]
          }
        ]
      }
    })
  }
}

# Grafana Deployment
resource "kubernetes_deployment" "grafana" {
  metadata {
    name      = "grafana"
    namespace = "monitoring"
    labels = {
      app = "grafana"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "grafana"
      }
    }

    template {
      metadata {
        labels = {
          app = "grafana"
        }
      }

      spec {
        container {
          name  = "grafana"
          image = "grafana/grafana:10.0.0"

          env {
            name  = "GF_SECURITY_ADMIN_PASSWORD"
            value = var.grafana_admin_password
          }

          env {
            name  = "GF_INSTALL_PLUGINS"
            value = "grafana-clock-panel,grafana-simple-json-datasource"
          }

          port {
            container_port = 3000
          }

          volume_mount {
            name       = "grafana-storage"
            mount_path = "/var/lib/grafana"
          }

          volume_mount {
            name       = "grafana-datasources"
            mount_path = "/etc/grafana/provisioning/datasources"
          }

          volume_mount {
            name       = "grafana-dashboards"
            mount_path = "/etc/grafana/provisioning/dashboards"
          }

          resources {
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
          }
        }

        volume {
          name = "grafana-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.grafana.metadata[0].name
          }
        }

        volume {
          name = "grafana-datasources"
          config_map {
            name = kubernetes_config_map.grafana_datasources.metadata[0].name
          }
        }

        volume {
          name = "grafana-dashboards"
          config_map {
            name = kubernetes_config_map.grafana_dashboards.metadata[0].name
          }
        }
      }
    }
  }
}

# Grafana PVC
resource "kubernetes_persistent_volume_claim" "grafana" {
  metadata {
    name      = "grafana-storage"
    namespace = "monitoring"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "5Gi"
      }
    }
    storage_class_name = "gp2"
  }
}

# Grafana Service
resource "kubernetes_service" "grafana" {
  metadata {
    name      = "grafana"
    namespace = "monitoring"
    labels = {
      app = "grafana"
    }
  }

  spec {
    selector = {
      app = "grafana"
    }

    port {
      port        = 3000
      target_port = 3000
    }

    type = "ClusterIP"
  }
}

# Loki Configuration
resource "kubernetes_config_map" "loki_config" {
  metadata {
    name      = "loki-config"
    namespace = "monitoring"
  }

  data = {
    "loki.yml" = yamlencode({
      auth_enabled = false
      server = {
        http_listen_port = 3100
      }
      ingester = {
        lifecycler = {
          address = "127.0.0.1"
          ring = {
            kvstore = {
              store = "inmemory"
            }
            replication_factor = 1
          }
          final_sleep = "0s"
        }
        chunk_idle_period = "5m"
        chunk_retain_period = "30s"
      }
      schema_config = {
        configs = [
          {
            from = "2020-05-15"
            store = "boltdb-shipper"
            object_store = "filesystem"
            schema = "v11"
            index = {
              prefix = "index_"
              period = "24h"
            }
          }
        ]
      }
      storage_config = {
        boltdb_shipper = {
          active_index_directory = "/tmp/loki/boltdb-shipper-active"
          cache_location = "/tmp/loki/boltdb-shipper-cache"
          cache_ttl = "24h"
          shared_store = "filesystem"
        }
        filesystem = {
          directory = "/tmp/loki/chunks"
        }
      }
      limits_config = {
        enforce_metric_name = false
        reject_old_samples = true
        reject_old_samples_max_age = "168h"
      }
      chunk_store_config = {
        max_look_back_period = "0s"
      }
      table_manager = {
        retention_deletes_enabled = false
        retention_period = "0s"
      }
    })
  }
}

# Loki Deployment
resource "kubernetes_deployment" "loki" {
  metadata {
    name      = "loki"
    namespace = "monitoring"
    labels = {
      app = "loki"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "loki"
      }
    }

    template {
      metadata {
        labels = {
          app = "loki"
        }
      }

      spec {
        container {
          name  = "loki"
          image = "grafana/loki:2.8.0"

          args = [
            "-config.file=/etc/loki/loki.yml"
          ]

          port {
            container_port = 3100
          }

          volume_mount {
            name       = "loki-config"
            mount_path = "/etc/loki"
          }

          volume_mount {
            name       = "loki-storage"
            mount_path = "/tmp/loki"
          }

          resources {
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
          }
        }

        volume {
          name = "loki-config"
          config_map {
            name = kubernetes_config_map.loki_config.metadata[0].name
          }
        }

        volume {
          name = "loki-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.loki.metadata[0].name
          }
        }
      }
    }
  }
}

# Loki PVC
resource "kubernetes_persistent_volume_claim" "loki" {
  metadata {
    name      = "loki-storage"
    namespace = "monitoring"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "10Gi"
      }
    }
    storage_class_name = "gp2"
  }
}

# Loki Service
resource "kubernetes_service" "loki" {
  metadata {
    name      = "loki"
    namespace = "monitoring"
    labels = {
      app = "loki"
    }
  }

  spec {
    selector = {
      app = "loki"
    }

    port {
      port        = 3100
      target_port = 3100
    }

    type = "ClusterIP"
  }
}

# Alertmanager Configuration
resource "kubernetes_config_map" "alertmanager_config" {
  metadata {
    name      = "alertmanager-config"
    namespace = "monitoring"
  }

  data = {
    "alertmanager.yml" = yamlencode({
      global = {
        resolve_timeout = "5m"
        slack_api_url = var.slack_webhook_url
      }
      route = {
        group_by = ["alertname"]
        group_wait = "10s"
        group_interval = "10s"
        repeat_interval = "1h"
        receiver = "slack-notifications"
      }
      receivers = [
        {
          name = "slack-notifications"
          slack_configs = [
            {
              channel = "#speccursor-alerts"
              title = "SpecCursor Alert"
              text = "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
            }
          ]
        }
      ]
    })
  }
}

# Alertmanager Deployment
resource "kubernetes_deployment" "alertmanager" {
  metadata {
    name      = "alertmanager"
    namespace = "monitoring"
    labels = {
      app = "alertmanager"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "alertmanager"
      }
    }

    template {
      metadata {
        labels = {
          app = "alertmanager"
        }
      }

      spec {
        container {
          name  = "alertmanager"
          image = "prom/alertmanager:v0.25.0"

          args = [
            "--config.file=/etc/alertmanager/alertmanager.yml",
            "--storage.path=/alertmanager"
          ]

          port {
            container_port = 9093
          }

          volume_mount {
            name       = "alertmanager-config"
            mount_path = "/etc/alertmanager"
          }

          volume_mount {
            name       = "alertmanager-storage"
            mount_path = "/alertmanager"
          }

          resources {
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }
        }

        volume {
          name = "alertmanager-config"
          config_map {
            name = kubernetes_config_map.alertmanager_config.metadata[0].name
          }
        }

        volume {
          name = "alertmanager-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.alertmanager.metadata[0].name
          }
        }
      }
    }
  }
}

# Alertmanager PVC
resource "kubernetes_persistent_volume_claim" "alertmanager" {
  metadata {
    name      = "alertmanager-storage"
    namespace = "monitoring"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "1Gi"
      }
    }
    storage_class_name = "gp2"
  }
}

# Alertmanager Service
resource "kubernetes_service" "alertmanager" {
  metadata {
    name      = "alertmanager"
    namespace = "monitoring"
    labels = {
      app = "alertmanager"
    }
  }

  spec {
    selector = {
      app = "alertmanager"
    }

    port {
      port        = 9093
      target_port = 9093
    }

    type = "ClusterIP"
  }
}

# Jaeger Configuration
resource "kubernetes_config_map" "jaeger_config" {
  metadata {
    name      = "jaeger-config"
    namespace = "monitoring"
  }

  data = {
    "jaeger.yml" = yamlencode({
      sampling = {
        default_strategy = {
          type = "probabilistic"
          param = 0.001
        }
      }
      storage = {
        type = "memory"
        options = {
          memory = {
            max_traces = 50000
          }
        }
      }
    })
  }
}

# Jaeger Deployment
resource "kubernetes_deployment" "jaeger" {
  metadata {
    name      = "jaeger"
    namespace = "monitoring"
    labels = {
      app = "jaeger"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "jaeger"
      }
    }

    template {
      metadata {
        labels = {
          app = "jaeger"
        }
      }

      spec {
        container {
          name  = "jaeger"
          image = "jaegertracing/all-in-one:1.47"

          env {
            name  = "COLLECTOR_OTLP_ENABLED"
            value = "true"
          }

          port {
            container_port = 16686
            name = "ui"
          }

          port {
            container_port = 14268
            name = "http"
          }

          port {
            container_port = 14250
            name = "grpc"
          }

          resources {
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# Jaeger Service
resource "kubernetes_service" "jaeger" {
  metadata {
    name      = "jaeger"
    namespace = "monitoring"
    labels = {
      app = "jaeger"
    }
  }

  spec {
    selector = {
      app = "jaeger"
    }

    port {
      name        = "ui"
      port        = 16686
      target_port = 16686
    }

    port {
      name        = "http"
      port        = 14268
      target_port = 14268
    }

    port {
      name        = "grpc"
      port        = 14250
      target_port = 14250
    }

    type = "ClusterIP"
  }
}

# Ingress for external access
resource "kubernetes_ingress_v1" "monitoring" {
  metadata {
    name      = "monitoring-ingress"
    namespace = "monitoring"
    annotations = {
      "kubernetes.io/ingress.class" = "alb"
      "alb.ingress.kubernetes.io/scheme" = "internet-facing"
      "alb.ingress.kubernetes.io/target-type" = "ip"
    }
  }

  spec {
    rule {
      host = "monitoring.${var.domain_name}"
      http {
        path {
          path = "/prometheus"
          path_type = "Prefix"
          backend {
            service {
              name = "prometheus"
              port {
                number = 9090
              }
            }
          }
        }
        path {
          path = "/grafana"
          path_type = "Prefix"
          backend {
            service {
              name = "grafana"
              port {
                number = 3000
              }
            }
          }
        }
        path {
          path = "/jaeger"
          path_type = "Prefix"
          backend {
            service {
              name = "jaeger"
              port {
                number = 16686
              }
            }
          }
        }
      }
    }
  }
}

# IAM Roles and Policies
resource "aws_iam_role" "eks_cluster" {
  name = "${var.project_name}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_vpc_resource_controller" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role" "eks_node_group" {
  name = "${var.project_name}-eks-node-group-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "ec2_container_registry_read_only" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_group.name
}

# Security Groups
resource "aws_security_group" "eks_cluster" {
  name_prefix = "${var.project_name}-eks-cluster-"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-eks-cluster-sg"
  })
}

resource "aws_security_group" "eks_node_group" {
  name_prefix = "${var.project_name}-eks-node-group-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-eks-node-group-sg"
  })
} 