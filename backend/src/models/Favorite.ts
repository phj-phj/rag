import { DataTypes, Model } from 'sequelize'
import sequelize from '../config/database'

interface FavoriteAttributes {
  user_id: number
  document_id: number
  created_at?: Date
}

class Favorite extends Model<FavoriteAttributes> implements FavoriteAttributes {
  declare user_id: number
  declare document_id: number
  declare created_at: Date
}

Favorite.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    document_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'Favorite',
    tableName: 'Favorites',
  }
)

export default Favorite
