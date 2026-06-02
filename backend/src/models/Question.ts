import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../config/database'

interface QuestionAttributes {
  id: number
  stem: string
  explanation: string
  type: 'essay'
  difficulty: number | null
  difficulty_votes: number[]
  knowledge_point: string | null
  source_type: 'extracted' | 'ai_pregenerated' | 'ai_adhoc'
  source_document_id: number | null
  created_at?: Date
  updated_at?: Date
}

type QuestionCreationAttributes = Optional<QuestionAttributes, 'id' | 'created_at' | 'updated_at'>

class Question extends Model<QuestionAttributes, QuestionCreationAttributes> implements QuestionAttributes {
  declare id: number
  declare stem: string
  declare explanation: string
  declare type: 'essay'
  declare difficulty: number | null
  declare difficulty_votes: number[]
  declare knowledge_point: string | null
  declare source_type: 'extracted' | 'ai_pregenerated' | 'ai_adhoc'
  declare source_document_id: number | null
  declare created_at: Date
  declare updated_at: Date
}

Question.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    stem: { type: DataTypes.TEXT, allowNull: false },
    explanation: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM('essay'), defaultValue: 'essay' },
    difficulty: { type: DataTypes.TINYINT, allowNull: true },
    difficulty_votes: { type: DataTypes.JSON, defaultValue: [] },
    knowledge_point: { type: DataTypes.STRING(200), allowNull: true },
    source_type: {
      type: DataTypes.ENUM('extracted', 'ai_pregenerated', 'ai_adhoc'),
      allowNull: false,
    },
    source_document_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Question',
    tableName: 'Questions',
  },
)

export default Question
