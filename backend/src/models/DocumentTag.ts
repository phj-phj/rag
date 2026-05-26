import { DataTypes, Model } from 'sequelize'
import sequelize from '../config/database'

interface DocumentTagAttributes {
  document_id: number
  tag_id: number
}

class DocumentTag extends Model<DocumentTagAttributes> implements DocumentTagAttributes {
  declare document_id: number
  declare tag_id: number
}

DocumentTag.init(
  {
    document_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    tag_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'DocumentTag',
    tableName: 'Document_Tags',
    timestamps: false,
  }
)

export default DocumentTag
