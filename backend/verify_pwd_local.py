from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = "$2b$12$Mv0ZimpYOr4/AiuaoJrTPeZpREKLpwZuMXEzffAC9S09RPMs1mC2S"
password = "arjun123"

if pwd_context.verify(password, hashed):
    print("Match!")
else:
    print("No match!")
