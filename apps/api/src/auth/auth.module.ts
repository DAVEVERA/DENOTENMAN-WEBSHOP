import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ArgonHasher } from "./argon-hasher";
import { JwtStrategy } from "./jwt.strategy";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { env } from "../env";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: env.JWT_ACCESS_SECRET,
        signOptions: {
          algorithm: "HS256",
          issuer: "denotenman-api",
          audience: "denotenman-client",
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ArgonHasher, JwtStrategy, RefreshTokenRepository],
  exports: [AuthService, ArgonHasher, JwtModule],
})
export class AuthModule {}
