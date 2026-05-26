import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../config/database'

interface DocumentChunkAttributes {
  id: number
  document_id: number
  chunk_index: number
  content: string
  token_count: number
  strategy: 'semantic' | 'fixed' | 'paragraph'
  heading: string | null
  position_start: number
  position_end: number
  created_at?: Date
}

type DocumentChunkCreationAttributes = Optional<
  DocumentChunkAttributes,
  'id' | 'heading' | 'created_at'
>

class DocumentChunk extends Model<DocumentChunkAttributes, DocumentChunkCreationAttributes> {
  declare id: number
  declare document_id: number
  declare chunk_index: number
  declare content: string
  declare token_count: number
  declare strategy: string
  declare heading: string | null
  declare position_start: number
  declare position_end: number
  declare created_at: Date
}

DocumentChunk.init(
  {
    id:             { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    document_id:    { type: DataTypes.INTEGER, allowNull: false },
    chunk_index:    { type: DataTypes.INTEGER, allowNull: false },
    content:        { type: DataTypes.TEXT,    allowNull: false },
    token_count:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    strategy:       { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'paragraph' },
    heading:        { type: DataTypes.STRING(200), allowNull: true },
    position_start: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    position_end:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'DocumentChunk',
    tableName: 'Document_Chunks',
    timestamps: true,
    updatedAt: false,
  }
)

export default DocumentChunk
