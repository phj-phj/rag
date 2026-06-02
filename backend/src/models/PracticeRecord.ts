import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../config/database'

interface PracticeRecordAttributes {
  id: number
  user_id: number
  question_id: number
  status: 'mastered' | 'review'
  created_at?: Date
}

type PracticeRecordCreationAttributes = Optional<PracticeRecordAttributes, 'id' | 'created_at'>

class PracticeRecord extends Model<PracticeRecordAttributes, PracticeRecordCreationAttributes> implements PracticeRecordAttributes {
  declare id: number
  declare user_id: number
  declare question_id: number
  declare status: 'mastered' | 'review'
  declare created_at: Date
}

PracticeRecord.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM('mastered', 'review'), allowNull: false },
  },
  {
    sequelize,
    modelName: 'PracticeRecord',
    tableName: 'PracticeRecords',
    timestamps: true,
    updatedAt: false,
  },
)

export default PracticeRecord
