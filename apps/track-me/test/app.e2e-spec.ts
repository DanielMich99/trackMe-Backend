import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { io } from 'socket.io-client';

describe('Family Tracker E2E Flow', () => {
  let app: INestApplication;

  // משתנים לשמירת נתונים בין השלבים
  let parentToken: string;
  let childToken: string;
  let parentId: string;
  let childId: string;
  let joinCode: string;

  // יוצרים אימיילים ייחודיים לכל הרצה
  const timestamp = Date.now();
  const parentEmail = `dad_${timestamp}@test.com`;
  const childEmail = `kid_${timestamp}@test.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // חשוב: פורט שונה מהשרת הרגיל למניעת התנגשויות
    await app.listen(3001);
  });

  // --- 1. רישום הורה ---
  it('/auth/register (POST) - Register Parent', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: parentEmail, password })
      .expect(201);
  });

  // --- 2. התחברות הורה ושמירת נתונים ---
  it('/auth/login (POST) - Login Parent & Get Token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: parentEmail, password })
      .expect(201);

    parentToken = response.body.access_token;
    parentId = response.body.userId; // שומרים ID לשימוש בסוקט
    expect(parentToken).toBeDefined();
  });

  // --- 3. יצירת קבוצה ---
  it('/groups/create (POST) - Parent creates a group', async () => {
    const response = await request(app.getHttpServer())
      .post('/groups/create')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ name: 'Test Family' })
      .expect(201);

    joinCode = response.body.joinCode;
    expect(joinCode).toHaveLength(6);
  });

  // --- 4. רישום ילד ---
  it('/auth/register (POST) - Register Child', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: childEmail, password })
      .expect(201);
  });

  // --- 5. התחברות ילד ושמירת נתונים ---
  it('/auth/login (POST) - Login Child', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: childEmail, password })
      .expect(201);

    childToken = response.body.access_token;
    childId = response.body.userId; // שומרים ID לשימוש בסוקט
    expect(childToken).toBeDefined();
  });

  // --- 6. הצטרפות לקבוצה ---
  it('/groups/join (POST) - Child joins the group', async () => {
    return request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${childToken}`)
      .send({ joinCode: joinCode })
      .expect(201)
      .expect((res) => {
        expect(res.body.group.name).toEqual('Test Family');
      });
  });

  // --- 7. בדיקת Real-Time (Sockets) ---
  it('Socket.io - Child sends location, Parent receives it', (done) => {
    // אבא מתחבר
    const parentSocket = io('http://localhost:3001', {
      query: { userId: parentId },
    });

    // ילד מתחבר
    const childSocket = io('http://localhost:3001', {
      query: { userId: childId },
    });

    // האבא מחכה לקבל הודעה
    parentSocket.on('newLocationReceived', (data) => {
      try {
        expect(data.userId).toBe(childId);
        expect(data.latitude).toBe(32.0853);
        expect(data.longitude).toBe(34.7818);

        parentSocket.close();
        childSocket.close();
        done();
      } catch (error) {
        done(error);
      }
    });

    // הילד שולח מיקום אחרי התחברות
    childSocket.on('connect', () => {
      setTimeout(() => {
        childSocket.emit('updateLocation', {
          latitude: 32.0853,
          longitude: 34.7818,
          userId: childId,
        });
      }, 500);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});