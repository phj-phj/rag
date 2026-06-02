import User from './User'
import Category from './Category'
import Tag from './Tag'
import Document from './Document'
import DocumentTag from './DocumentTag'
import Favorite from './Favorite'
import DocumentChunk from './DocumentChunk'
import Question from './Question'
import PracticeRecord from './PracticeRecord'

export function defineAssociations(): void {
  User.hasMany(Document, { foreignKey: 'uploader_id', as: 'documents' })
  Document.belongsTo(User, { foreignKey: 'uploader_id', as: 'uploader' })

  Category.hasMany(Document, { foreignKey: 'category_id', as: 'documents' })
  Document.belongsTo(Category, { foreignKey: 'category_id', as: 'category' })

  Document.belongsToMany(Tag, { through: DocumentTag, foreignKey: 'document_id', as: 'tags' })
  Tag.belongsToMany(Document, { through: DocumentTag, foreignKey: 'tag_id', as: 'documents' })

  User.belongsToMany(Document, { through: Favorite, foreignKey: 'user_id', as: 'favorites' })
  Document.belongsToMany(User, { through: Favorite, foreignKey: 'document_id', as: 'favoritedBy' })

  Document.hasMany(DocumentChunk, { foreignKey: 'document_id', as: 'chunks' })
  DocumentChunk.belongsTo(Document, { foreignKey: 'document_id', as: 'document' })

  // 新增关联
  Document.hasMany(Question, { foreignKey: 'source_document_id', as: 'questions' })
  Question.belongsTo(Document, { foreignKey: 'source_document_id', as: 'sourceDocument' })

  Question.hasMany(PracticeRecord, { foreignKey: 'question_id', as: 'practiceRecords' })
  PracticeRecord.belongsTo(Question, { foreignKey: 'question_id', as: 'question' })

  User.hasMany(PracticeRecord, { foreignKey: 'user_id', as: 'practiceRecords' })
  PracticeRecord.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
}

export { User, Category, Tag, Document, DocumentTag, Favorite, DocumentChunk, Question, PracticeRecord }
