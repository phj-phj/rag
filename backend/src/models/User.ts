import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../config/database'

interface UserAttributes {
  id: number
  username: string
  password: string
  role: 'user' | 'admin'
  created_at?: Date
  updated_at?: Date
}

type UserCreationAttributes = Optional<UserAttributes, 'id' | 'created_at' | 'updated_at'>

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number
  declare username: string
  declare password: string
  declare role: 'user' | 'admin'
  declare created_at: Date
  declare updated_at: Date
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'Users',
  }
)

export default User
