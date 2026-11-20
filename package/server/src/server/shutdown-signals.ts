export function registerShutdownSignals(onShutdown: () => Promise<void>): void {
  const handler = () => {
    onShutdown().then(() => {
      setTimeout(function () {
        process.exit(0)
      }, 5000)
    })
  }
  process.on('SIGINT', handler)
  process.on('SIGTERM', handler)
}
