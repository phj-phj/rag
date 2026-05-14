import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../config/database'

interface CategoryAttributes {
  id: number
  name: string
  created_at?: Date
  updated_at?: Date
}

type CategoryCreationAttributes = Optional<CategoryAttributes, 'id' | 'created_at' | 'updated_at'>

class Category extends Model<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
  declare id: number
  declare name: string
  declare created_at: Date
  declare updated_at: Date
}

Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Category',
    tableName: 'Categories',
  }
)

export default Category
