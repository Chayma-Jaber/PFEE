import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductQA } from './entities/product-qa.entity';
import { AskQuestionDto, AnswerQuestionDto } from './dto/product-qa.dto';

@Injectable()
export class ProductQAService {
  constructor(
    @InjectRepository(ProductQA)
    private readonly qaRepo: Repository<ProductQA>,
  ) {}

  async getProductQuestions(productId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [questions, total] = await this.qaRepo
      .createQueryBuilder('qa')
      .leftJoinAndSelect('qa.user', 'user')
      .leftJoinAndSelect('qa.answeredByUser', 'answerer')
      .where('qa.product_id = :productId', { productId })
      .andWhere('qa.is_published = :published', { published: true })
      .orderBy('qa.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      questions: questions.map((q) => ({
        id: q.id,
        product_id: q.product_id,
        question: q.question,
        answer: q.answer,
        helpful_count: q.helpful_count,
        created_at: q.created_at,
        answered_at: q.answered_at,
        user: q.user
          ? {
              id: q.user.id,
              first_name: q.user.first_name,
              last_name: q.user.last_name,
            }
          : null,
        answered_by: q.answeredByUser
          ? {
              id: q.answeredByUser.id,
              first_name: q.answeredByUser.first_name,
              last_name: q.answeredByUser.last_name,
            }
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async askQuestion(productId: number, userId: number, dto: AskQuestionDto) {
    const qa = this.qaRepo.create({
      product_id: productId,
      user_id: userId,
      question: dto.question,
    });

    const saved = await this.qaRepo.save(qa);
    return saved;
  }

  async answerQuestion(qaId: number, adminId: number, dto: AnswerQuestionDto) {
    const qa = await this.qaRepo.findOne({ where: { id: qaId } });
    if (!qa) {
      throw new NotFoundException('Question not found');
    }

    qa.answer = dto.answer;
    qa.answered_by = adminId;
    qa.answered_at = new Date();

    const saved = await this.qaRepo.save(qa);
    return saved;
  }

  async deleteQuestion(qaId: number) {
    const qa = await this.qaRepo.findOne({ where: { id: qaId } });
    if (!qa) {
      throw new NotFoundException('Question not found');
    }

    await this.qaRepo.remove(qa);
    return { message: 'Question deleted successfully' };
  }
}
