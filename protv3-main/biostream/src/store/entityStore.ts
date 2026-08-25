/**
 * Zustand store for the Entity Registry.
 * Every sequence, alignment, API result, and workspace is an entity
 * with typed relationships — enabling Benchling-style entity navigation.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EntityType =
  | 'sequence'
  | 'alignment'
  | 'worksheet-row'
  | 'api-result'
  | 'notebook-entry'
  | 'workspace'

export interface EntityRelationship {
  targetId: string
  type: string // e.g. 'belongs-to', 'aligns', 'derived-from'
}

export interface Entity {
  id: string
  type: EntityType
  name: string
  description?: string
  tags: string[]
  relationships: EntityRelationship[]
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface EntityState {
  entities: Record<string, Entity>

  // CRUD
  addEntity: (entity: Entity) => void
  removeEntity: (id: string) => void
  updateEntity: (id: string, updates: Partial<Entity>) => void

  // Relationships
  addRelationship: (sourceId: string, targetId: string, type: string) => void
  removeRelationship: (sourceId: string, targetId: string, type?: string) => void

  // Queries
  getEntity: (id: string) => Entity | undefined
  getRelatedEntities: (id: string) => Entity[]
  getEntitiesByType: (type: EntityType) => Entity[]
  searchEntities: (query: string) => Entity[]
  getAllEntities: () => Entity[]
}

export const useEntityStore = create<EntityState>()(
  persist(
    (set, get) => ({
      entities: {},

      addEntity: (entity) => {
        set(state => ({
          entities: { ...state.entities, [entity.id]: entity },
        }))
      },

      removeEntity: (id) => {
        set(state => {
          const next = { ...state.entities }
          delete next[id]
          // Also remove any relationships pointing to this entity
          Object.values(next).forEach(entity => {
            entity.relationships = entity.relationships.filter(r => r.targetId !== id)
          })
          return { entities: next }
        })
      },

      updateEntity: (id, updates) => {
        set(state => {
          const existing = state.entities[id]
          if (!existing) return state
          return {
            entities: {
              ...state.entities,
              [id]: { ...existing, ...updates, updatedAt: new Date().toISOString() },
            },
          }
        })
      },

      addRelationship: (sourceId, targetId, type) => {
        set(state => {
          const entity = state.entities[sourceId]
          if (!entity) return state
          const exists = entity.relationships.some(
            r => r.targetId === targetId && r.type === type
          )
          if (exists) return state
          return {
            entities: {
              ...state.entities,
              [sourceId]: {
                ...entity,
                relationships: [...entity.relationships, { targetId, type }],
                updatedAt: new Date().toISOString(),
              },
            },
          }
        })
      },

      removeRelationship: (sourceId, targetId, type) => {
        set(state => {
          const entity = state.entities[sourceId]
          if (!entity) return state
          return {
            entities: {
              ...state.entities,
              [sourceId]: {
                ...entity,
                relationships: entity.relationships.filter(r =>
                  !(r.targetId === targetId && (!type || r.type === type))
                ),
                updatedAt: new Date().toISOString(),
              },
            },
          }
        })
      },

      getEntity: (id) => get().entities[id],

      getRelatedEntities: (id) => {
        const { entities } = get()
        const entity = entities[id]
        if (!entity) return []
        return entity.relationships
          .map(r => entities[r.targetId])
          .filter(Boolean) as Entity[]
      },

      getEntitiesByType: (type) => {
        return Object.values(get().entities).filter(e => e.type === type)
      },

      searchEntities: (query) => {
        const q = query.toLowerCase()
        return Object.values(get().entities).filter(e =>
          e.name.toLowerCase().includes(q) ||
          e.tags.some(t => t.toLowerCase().includes(q)) ||
          e.type.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q))
        )
      },

      getAllEntities: () => Object.values(get().entities),
    }),
    {
      name: 'biostream-entities',
      partialize: (state) => ({ entities: state.entities }),
    }
  )
)
