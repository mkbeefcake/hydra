import { Metadata } from '@polkadot/types'
import { TypeRegistry } from '@polkadot/types/create'
import { WebSocket } from '@polkadot/x-ws'
import BN from 'bn.js'
import path from 'path'

const debug = require('debug')('hydra-typegen:metadata')

export const registry = new TypeRegistry()

export interface MetadataSource {
  source: string
  blockHash?: string
  spec?: ChainSpec
}

interface ChainSpec {
  specName: string
  specVersion: number
}

export async function getMetadata({
  source,
  blockHash,
}: MetadataSource): Promise<Metadata> {
  let metaHex: string | undefined
  debug(`Reading metadata: from ${source}`)

  if (source.startsWith('wss://') || source.startsWith('ws://')) {
    debug(`Reading from chain: ${source}`)
    metaHex = await fromChain(source, blockHash)
  } else {
    throw new Error(
      `Unsupported metadata source: ${source}. Typegen only supports reading metadata from a chain. Please provide a a valid chain endpoint.`
    )
  }

  const meta = new Metadata(registry, metaHex as `0x${string}`)

  registry.setMetadata(meta)

  return meta
}

export async function getChainSpec(endpoint: string): Promise<ChainSpec> {
  return new Promise<ChainSpec>((resolve, reject) => {
    try {
      const websocket = new WebSocket(endpoint)

      websocket.onclose = (event: { code: number; reason: string }): void => {
        reject(
          new Error(
            `disconnected, code: '${event.code}' reason: '${event.reason}'`
          )
        )
      }

      websocket.onerror = (event: unknown): void => {
        reject(new Error(JSON.stringify(event, null, 2)))
      }

      websocket.onopen = (): void => {
        debug('connected')
        websocket.send(
          `{"id":1, "jsonrpc":"2.0", "method": "state_getRuntimeVersion"}`
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      websocket.onmessage = (message: any): void => {
        const data = JSON.parse(message.data)
        if (data.error) {
          reject(new Error(`RPC error: ${JSON.stringify(data.error, null, 2)}`))
        } else {
          resolve(data.result)
        }
        websocket.close()
      }
    } catch (e) {
      reject(
        new Error(
          `Cannot fetch chain spec: ${(e as Error).message}, ${JSON.stringify(
            e,
            null,
            2
          )}`
        )
      )
    }
  })
}

async function fromChain(
  endpoint: string,
  blockHash: string | undefined
): Promise<string> {
  const blockHashParam = blockHash ? `"${blockHash}"` : ''
  return new Promise<string>((resolve, reject) => {
    try {
      const websocket = new WebSocket(endpoint)

      websocket.onclose = (event: { code: number; reason: string }): void => {
        reject(
          new Error(
            `disconnected, code: '${event.code}' reason: '${event.reason}'`
          )
        )
      }

      websocket.onerror = (event: unknown): void => {
        reject(new Error(JSON.stringify(event, null, 2)))
      }

      websocket.onopen = (): void => {
        debug('connected')
        // TODO: support chain height
        websocket.send(
          `{"id":"1","jsonrpc":"2.0","method":"state_getMetadata","params":[${blockHashParam}]}`
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      websocket.onmessage = (message: any): void => {
        const data = JSON.parse(message.data)
        if (data.error) {
          reject(new Error(`RPC error: ${JSON.stringify(data.error, null, 2)}`))
        } else {
          resolve(data.result)
        }
        websocket.close()
      }
    } catch (e) {
      reject(
        new Error(
          `Cannot fetch metadata: ${(e as Error).message}, ${JSON.stringify(
            e,
            null,
            2
          )}`
        )
      )
    }
  })
}
