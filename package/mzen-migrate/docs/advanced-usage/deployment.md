# Deployment Integration

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy with Migrations

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: pnpm install

      - name: Backup Database
        run: |
          mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME > backup.sql
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASS: ${{ secrets.DB_PASS }}
          DB_NAME: ${{ secrets.DB_NAME }}

      - name: Run Migrations (Dry Run)
        run: |
          pnpm mzen-migrate --config ./migrate.config.js --datasource db --dry-run

      - name: Run Migrations
        run: |
          pnpm mzen-migrate --config ./migrate.config.js --datasource db

      - name: Verify Application
        run: pnpm run test:integration
```

### Kubernetes Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
spec:
  ttlSecondsAfterFinished: 3600
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: myapp:latest
          command:
            [
              "pnpm",
              "mzen-migrate",
              "--config",
              "./migrate.config.js",
              "--datasource",
              "db",
            ]
          envFrom:
            - configMapRef:
                name: db-config
            - secretRef:
                name: db-secrets
```

## Related Documentation

- [Advanced Usage Index](./index.md)
- [Performance and Testing](./performance-and-testing.md)
- [Troubleshooting](./troubleshooting.md)
