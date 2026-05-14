// Azure infrastructure for Shopping List App (simplified)
// Single container app, PostgreSQL Flexible Server
// Images from ghcr.io, secrets via env vars

@description('Environment name')
param envName string = 'shoppinglist'

@description('Location for resources')
param location string = resourceGroup().location

@description('Azure PostgreSQL administrator login')
param postgresAdminLogin string

@description('Azure PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('Container image URL (e.g., ghcr.io/owner/repo:sha)')
param image string = 'nginx:latest'

@description('Container registry server (e.g., ghcr.io)')
param registryServer string = ''

@description('Container registry username')
param registryUsername string = ''

@description('Container registry password')
@secure()
param registryPassword string = ''

@description('SECRET_KEY for JWT signing')
@secure()
param secretKey string

@description('REGISTRATION_KEY for invite-only registration')
@secure()
param registrationKey string

// Container Apps Environment
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2022-03-01' = {
  name: '${envName}-env'
  location: location
  properties: {}
}

// Single Container App
resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${envName}-app'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    'azd-service-name': 'app'
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
      }
      registries: !empty(registryPassword) ? [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ] : []
      secrets: !empty(registryPassword) ? [
        {
          name: 'registry-password'
          value: registryPassword
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: '${envName}-app'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
          env: [
            {
              name: 'SECRET_KEY'
              value: secretKey
            }
            {
              name: 'REGISTRATION_KEY'
              value: registrationKey
            }
            {
              name: 'DATABASE_URL'
              value: 'postgresql+asyncpg://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/shoppinglist?sslmode=require'
            }
            {
              name: 'STATIC_DIR'
              value: 'static'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              initialDelaySeconds: 30
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              periodSeconds: 10
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: '${envName}-postgres'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    highAvailability: {
      mode: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
  }
  resource db 'databases' = {
    name: 'shoppinglist'
    properties: {
      charset: 'UTF8'
      collation: 'en_US.UTF8'
    }
  }
}

// PostgreSQL firewall rule to allow Azure services
resource postgresFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  name: '${envName}-postgres/AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Outputs
output APP_URL string = app.properties.configuration.ingress.fqdn
output DATABASE_HOST string = postgresServer.properties.fullyQualifiedDomainName
output DATABASE_NAME string = 'shoppinglist'
@description('Database admin username — treat as sensitive')
output DATABASE_USER string = postgresAdminLogin
