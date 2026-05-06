// Azure infrastructure for Shopping List App
// Deploys: Azure Container Apps, PostgreSQL Flexible Server

@description('Environment name')
param envName string = 'shoppinglist'

@description('Location for resources')
param location string = resourceGroup().location

@description('Azure PostgreSQL administrator login')
param postgresAdminLogin string

@description('Azure PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('JWT secret key for API')
@secure()
param secretKey string

@description('Registration invite code')
@secure()
param registrationKey string

@description('API container image')
param apiImage string = 'nginx:latest'

@description('Web container image')
param webImage string = 'nginx:latest'

@description('Azure Container Registry name')
param containerRegistryName string = '${envName}acr'

@description('Azure Container Registry SKU')
param containerRegistrySku string = 'Basic'

@description('Azure Key Vault name')
param keyVaultName string = 'shoppinglist-kv'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2021-09-01' = {
  name: containerRegistryName
  location: location
  sku: {
    name: containerRegistrySku
  }
  properties: {
    adminUserEnabled: true
  }
}

// Container Apps Environment
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2022-03-01' = {
  name: '${envName}-env'
  location: location
  properties: {}
}

// API Container App
resource apiContainerApp 'Microsoft.App/containerApps@2022-03-01' = {
  name: '${envName}-api'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    'azd-service-name': 'api'
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.name
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'secret-key'
          value: keyVault.getSecret('secret-key')
        }
        {
          name: 'registration-key'
          value: keyVault.getSecret('registration-key')
        }
      ]
      env: [
        {
          name: 'ALLOWED_ORIGINS'
          value: 'https://${webContainerApp.properties.configuration.ingress.fqdn}'
        }
        {
          name: 'SECRET_KEY'
          secretRef: 'secret-key'
        }
        {
          name: 'REGISTRATION_KEY'
          secretRef: 'registration-key'
        }
        {
          name: 'DATABASE_URL'
          value: 'postgresql+asyncpg://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/shoppinglist?sslmode=require'
        }
      ]
    }
    template: {
      containers: [
        {
          name: '${envName}-api'
          image: apiImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
    }
  }
}

// Web Container App
resource webContainerApp 'Microsoft.App/containerApps@2022-03-01' = {
  name: '${envName}-web'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    'azd-service-name': 'web'
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.name
          passwordSecretRef: 'acr-password'
        }
      ]
      env: [
        {
          name: 'VITE_API_URL'
          value: 'https://${apiContainerApp.properties.configuration.ingress.fqdn}'
        }
      ]
    }
    template: {
      containers: [
        {
          name: '${envName}-web'
          image: webImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
    }
  }
}

// PostgreSQL Flexible Server (reuse existing if already created)
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
      charset: 'utf8'
      collation: 'en_US.utf8'
    }
  }
}

// Output values
output API_APP_URL string = apiContainerApp.properties.configuration.ingress.fqdn
output WEB_APP_URL string = webContainerApp.properties.configuration.ingress.fqdn
output DATABASE_HOST string = postgresServer.properties.fullyQualifiedDomainName
output DATABASE_NAME string = 'shoppinglist'
output DATABASE_USER string = postgresAdminLogin
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer