import User from './User'
import Category from './Category'
import Tag from './Tag'
import Document from './Document'
import DocumentTag from './DocumentTag'
import Favorite from './Favorite'
import DocumentChunk from './DocumentChunk'

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
}

export { User, Category, Tag, Document, DocumentTag, Favorite, DocumentChunk }
