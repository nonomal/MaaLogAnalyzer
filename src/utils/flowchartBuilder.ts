import type { Node, Edge } from '@vue-flow/core'
import dagre from '@dagrejs/dagre'
import type { TaskInfo, NodeInfo } from '../types'

export interface FlowNodeData {
  label: string
  status: 'success' | 'failed' | 'not-executed'
  executionOrder: number[]
  nodeInfos: NodeInfo[]
}

export interface FlowEdgeData {
  executed: boolean
  anchor: boolean
  jump_back: boolean
  edgeStatus: 'success' | 'failed' | 'topology'
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

export function buildFlowchartData(task: TaskInfo): { nodes: Node[]; edges: Edge[] } {
  // 1. Collect executed node names with order and info
  const executedNodeMap = new Map<string, { order: number[]; infos: NodeInfo[] }>()
  task.nodes.forEach((node, index) => {
    const existing = executedNodeMap.get(node.name)
    if (existing) {
      existing.order.push(index + 1)
      existing.infos.push(node)
    } else {
      executedNodeMap.set(node.name, { order: [index + 1], infos: [node] })
    }
  })

  // 2. Collect all node names from next_list (unexecuted placeholders)
  const allNodeNames = new Set<string>(executedNodeMap.keys())
  task.nodes.forEach(node => {
    node.next_list.forEach(next => {
      allNodeNames.add(next.name)
    })
  })

  // 3. Build nodes
  const flowNodes: Node[] = []
  allNodeNames.forEach(name => {
    const executed = executedNodeMap.get(name)
    let status: FlowNodeData['status'] = 'not-executed'
    if (executed) {
      const lastInfo = executed.infos[executed.infos.length - 1]
      status = lastInfo.status === 'failed' ? 'failed' : 'success'
    }

    flowNodes.push({
      id: name,
      type: 'flowchartNode',
      position: { x: 0, y: 0 },
      data: {
        label: name,
        status,
        executionOrder: executed?.order ?? [],
        nodeInfos: executed?.infos ?? [],
      } satisfies FlowNodeData,
    })
  })

  // 4. Build edges
  const flowEdges: Edge[] = []
  const edgeSet = new Set<string>()

  // Topology edges from next_list
  task.nodes.forEach(node => {
    node.next_list.forEach(next => {
      const edgeId = `${node.name}->${next.name}`
      if (edgeSet.has(edgeId)) return
      edgeSet.add(edgeId)

      flowEdges.push({
        id: edgeId,
        source: node.name,
        target: next.name,
        data: {
          executed: false,
          anchor: next.anchor,
          jump_back: next.jump_back,
          edgeStatus: 'topology',
        } satisfies FlowEdgeData,
      })
    })
  })

  // Execution edges: consecutive nodes
  for (let i = 0; i < task.nodes.length - 1; i++) {
    const from = task.nodes[i].name
    const to = task.nodes[i + 1].name
    const edgeId = `${from}->${to}`

    const existing = flowEdges.find(e => e.id === edgeId)
    const toNodeStatus = task.nodes[i + 1].status === 'failed' ? 'failed' : 'success'

    if (existing) {
      // Mark topology edge as executed
      existing.data = {
        ...existing.data,
        executed: true,
        edgeStatus: toNodeStatus,
      }
    } else {
      // Create new execution edge (not in topology)
      flowEdges.push({
        id: edgeId,
        source: from,
        target: to,
        data: {
          executed: true,
          anchor: false,
          jump_back: false,
          edgeStatus: toNodeStatus,
        } satisfies FlowEdgeData,
      })
    }
  }

  // 5. Dagre layout
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 })

  flowNodes.forEach(node => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  flowEdges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  // Apply positions
  flowNodes.forEach(node => {
    const dagreNode = g.node(node.id)
    node.position = {
      x: dagreNode.x - NODE_WIDTH / 2,
      y: dagreNode.y - NODE_HEIGHT / 2,
    }
  })

  return { nodes: flowNodes, edges: flowEdges }
}
