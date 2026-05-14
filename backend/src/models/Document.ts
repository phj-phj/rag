import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../config/database'

interface DocumentAttributes {
  id: number
  title: string
  file_type: string
  file_size: number
  file_path: string
  uploader_id: number
  category_id: number | null
  is_featured: boolean
  created_at?: Date
  updated_at?: Date
}

type DocumentCreationAttributes = Optional<DocumentAttributes, 'id' | 'created_at' | 'updated_at'>

class Document extends Model<DocumentAttributes, DocumentCreationAttributes> implements DocumentAttributes {
  declare id: number
  declare title: string
  declare file_type: string
  declare file_size: number
  declare file_path: string
  declare uploader_id: number
  declare category_id: number | null
  declare is_featured: boolean
  declare created_at: Date
  declare updated_at: Date
}

Document.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    uploader_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Document',
    tableName: 'Documents',
  }
)

export default Document
