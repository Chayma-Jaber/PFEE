import { IsString, IsNotEmpty } from 'class-validator';

export class RedeemGiftCardDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
