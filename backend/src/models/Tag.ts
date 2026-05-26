import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../config/database'

interface TagAttributes {
  id: number
  name: string
  created_at?: Date
  updated_at?: Date
}

type TagCreationAttributes = Optional<TagAttributes, 'id' | 'created_at' | 'updated_at'>

class Tag extends Model<TagAttributes, TagCreationAttributes> implements TagAttributes {
  declare id: number
  declare name: string
  declare created_at: Date
  declare updated_at: Date
}

Tag.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: 'Tag',
    tableName: 'Tags',
  }
)

export default Tag
